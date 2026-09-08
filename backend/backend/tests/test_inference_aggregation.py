import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[3] / "Huggingface Space files" / "ai_inference_server.py"
spec = importlib.util.spec_from_file_location("aivala_inference_for_test", MODULE_PATH)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def detection(label, confidence, bbox, frame_index, width=1000, height=1000):
    return {
        "label": label,
        "confidence": confidence,
        "bbox": bbox,
        "frame_index": frame_index,
        "frame_width": width,
        "frame_height": height,
    }


def test_keeps_two_separate_same_class_damages():
    candidates = [
        detection("dent", 0.95, [50, 100, 180, 240], 1),
        detection("dent", 0.91, [760, 700, 920, 860], 10),
    ]
    retained = module._deduplicate_detections(candidates)
    assert len(retained) == 2


def test_collapses_repeated_observation_of_same_area():
    candidates = [
        detection("scratch", 0.86, [200, 200, 400, 400], 1),
        detection("scratch", 0.97, [205, 204, 405, 404], 2),
    ]
    retained = module._deduplicate_detections(candidates)
    assert len(retained) == 1
    assert retained[0]["confidence"] == 0.97


def test_different_classes_are_not_deduplicated():
    candidates = [
        detection("dent", 0.8, [200, 200, 400, 400], 1),
        detection("scratch", 0.79, [205, 204, 405, 404], 1),
    ]
    assert len(module._deduplicate_detections(candidates)) == 2
