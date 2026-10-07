"""Export the classifier to ONNX (and an int8 version) for offline use in the browser or on a phone.

  python -m cropcare_ai.training.export_onnx

Writes model.onnx and model.int8.onnx into the model folder and checks that
ONNX Runtime gives the same answer as PyTorch.
"""

from __future__ import annotations

import argparse

import numpy as np
import torch

from cropcare_ai.models.bundle import load_classifier, read_json, write_json
from cropcare_ai.settings import get_settings
from cropcare_ai.training.common import resolve_path


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model-dir", default=str(get_settings().classifier_dir))
    parser.add_argument("--opset", type=int, default=17)
    parser.add_argument("--skip-int8", action="store_true")
    args = parser.parse_args(argv)

    import onnxruntime as ort

    model_dir = resolve_path(args.model_dir)
    model, bundle = load_classifier(model_dir, "cpu")
    dummy = torch.randn(1, 3, bundle.image_size, bundle.image_size)
    onnx_path = model_dir / "model.onnx"

    torch.onnx.export(model, dummy, str(onnx_path), input_names=["image"], output_names=["logits"],
                      dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}}, opset_version=args.opset,
                      dynamo=False)

    with torch.no_grad():
        expected = model(dummy).numpy()
    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    actual = session.run(None, {"image": dummy.numpy()})[0]
    max_diff = float(np.abs(expected - actual).max())
    print(f"ONNX export OK ({onnx_path.stat().st_size / 1e6:.1f} MB), max difference vs PyTorch {max_diff:.2e}")

    info = {"fp32": {"file": "model.onnx", "max_abs_diff": max_diff, "mb": onnx_path.stat().st_size / 1e6}}
    if not args.skip_int8:
        from onnxruntime.quantization import QuantType, quantize_dynamic

        int8_path = model_dir / "model.int8.onnx"
        quantize_dynamic(str(onnx_path), str(int8_path), weight_type=QuantType.QUInt8)
        int8 = ort.InferenceSession(str(int8_path), providers=["CPUExecutionProvider"]).run(None, {"image": dummy.numpy()})[0]
        same_top1 = bool(int8.argmax() == expected.argmax())
        info["int8"] = {"file": "model.int8.onnx", "mb": int8_path.stat().st_size / 1e6, "same_top1_on_check": same_top1}
        print(f"int8 model {info['int8']['mb']:.1f} MB (same top-1 on check image: {same_top1})")

    export = {**info, "class_ids": bundle.class_ids, "image_size": bundle.image_size,
              "mean": list(bundle.mean), "std": list(bundle.std),
              "calibration": read_json(model_dir / "calibration.json")}
    write_json(export, model_dir / "onnx_export.json")


if __name__ == "__main__":
    main()
