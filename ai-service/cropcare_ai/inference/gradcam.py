"""Grad-CAM for any timm classifier: which parts of the photo drove the prediction.

Works with CNNs (feature maps B,C,H,W or B,H,W,C) and ViTs (tokens B,N,C) by
using timm's forward_features / forward_head split.
"""

from __future__ import annotations

import math

import numpy as np
import torch
from torch import nn


def _to_bchw(features: torch.Tensor, model: nn.Module) -> torch.Tensor:
    channels = getattr(model, "num_features", None)
    if features.ndim == 4:
        if features.shape[1] != channels and features.shape[-1] == channels:
            features = features.permute(0, 3, 1, 2)       # NHWC (e.g. Swin) -> NCHW
        return features
    if features.ndim == 3:                                  # ViT tokens
        tokens = features[:, getattr(model, "num_prefix_tokens", 1):, :]
        side = int(math.isqrt(tokens.shape[1]))
        return tokens[:, : side * side, :].transpose(1, 2).reshape(tokens.shape[0], -1, side, side)
    raise ValueError(f"Unsupported feature shape {tuple(features.shape)}")


def grad_cam(model: nn.Module, image: torch.Tensor, class_index: int) -> np.ndarray:
    """Return a heat map in [0, 1] with the image's height/width (image: 1x3xHxW)."""
    model.zero_grad(set_to_none=True)
    with torch.enable_grad():
        features = model.forward_features(image)
        features.retain_grad()
        logits = model.forward_head(features)
        logits[0, class_index].backward()

    activations = _to_bchw(features.detach(), model)
    gradients = _to_bchw(features.grad, model)
    weights = gradients.mean(dim=(2, 3), keepdim=True)
    cam = torch.relu((weights * activations).sum(dim=1, keepdim=True))
    cam = nn.functional.interpolate(cam, size=image.shape[-2:], mode="bilinear", align_corners=False)[0, 0]
    cam = cam - cam.min()
    peak = cam.max()
    model.zero_grad(set_to_none=True)
    return (cam / peak).cpu().numpy() if peak > 0 else cam.cpu().numpy()
