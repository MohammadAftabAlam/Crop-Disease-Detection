"""Put every evaluated test set side by side (the "honesty table" for the report and viva).

  python -m cropcare_ai.training.report
  python -m cropcare_ai.training.report --model-dir artifacts/classifier artifacts/classifier_mobilenet

Writes report.md next to the metrics of the first model folder.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from cropcare_ai.models.bundle import read_json
from cropcare_ai.settings import get_settings
from cropcare_ai.training.common import resolve_path


def pct(value) -> str:
    return "—" if value is None else f"{value * 100:.1f}%"


def build_report(model_dirs: list[Path]) -> str:
    lines = [
        "# Model evaluation report",
        "",
        "| Model | Test set | Images | Accuracy | Macro-F1 | Crop acc. | ECE | Coverage (target) | Confident | Acc. when confident |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for model_dir in model_dirs:
        bundle = read_json(model_dir / "bundle.json") or {}
        for path in sorted((model_dir / "metrics").glob("*.json")):
            m = json.loads(path.read_text(encoding="utf-8"))
            conformal = m["conformal"]
            target = pct(conformal["target_coverage"]) if conformal["target_coverage"] else "uncalibrated"
            lines.append(
                f"| {bundle.get('architecture', model_dir.name)} | {m['description']} | {m['num_images']} | "
                f"{pct(m['accuracy'])} | {pct(m['macro_f1'])} | {pct(m['crop_accuracy'])} | {m['ece']:.3f} | "
                f"{pct(conformal['coverage'])} ({target}) | {pct(m['status_rates']['confident'])} | "
                f"{pct(m['accuracy_when_confident'])} |"
            )
    lines += [
        "",
        "- **Accuracy** counts every image; the app instead shows a diagnosis only when the model is *confident*.",
        "- **Coverage**: how often the true disease is inside the model's set of possible answers.",
        "- **ECE**: gap between stated confidence and real accuracy (0 is perfect).",
    ]
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model-dir", nargs="+", default=[str(get_settings().classifier_dir)])
    args = parser.parse_args(argv)

    model_dirs = [resolve_path(d) for d in args.model_dir]
    report = build_report(model_dirs)
    (model_dirs[0] / "report.md").write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
