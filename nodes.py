import torch
import numpy as np
import json
from scipy.interpolate import interp1d

class CustomSplineSigma:
    CATEGORY = "image/generator"
    RETURN_TYPES = ("STRING", "SIGMAS")
    RETURN_NAMES = ("curve_data", "sigmas")
    FUNCTION = "render"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "steps": ("INT", {"default": 20, "min": 2, "max": 4096}),
                "start_y": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "end_y": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01}),
            },
            "hidden": {
                "curve_data": ("STRING", {"default": "{\"control_points\":[{\"x\":0,\"y\":1},{\"x\":1,\"y\":0}]}"})
            }
        }

    def __init__(self):
        pass

    def render(self, steps, curve_data="", start_y=1.0, end_y=0.0):
        # --- Parse curve_data for control_points and samples ---
        try:
            data = json.loads(curve_data) if curve_data else {}
            points = data.get("control_points", None)
            
            # Use deserialized points if available and no valid points in curve_data
            if not points and hasattr(self, 'cached_control_points'):
                points = self.cached_control_points
            
            # Fallback to default if still no points
            if not points:
                points = [
                    {"x": 0.0, "y": start_y},
                    {"x": 1.0, "y": end_y}
                ]
                
            # Cache these for serialization
            self.cached_control_points = points
            
            samples = data.get("samples", None)
        except Exception as e:
            print(f"[CustomSplineSigma] Bad input: {str(e)}")
            samples = None
            points = [
                {"x": 0.0, "y": start_y},
                {"x": 1.0, "y": end_y}
            ]
            self.cached_control_points = points

        # --- Use JS samples if available for pixel-perfect match ---
        if samples and isinstance(samples, list) and len(samples) > 1:
            curve_points = samples
        else:
            # --- Fallback: Use control points and Python interpolation ---
            ctrl_x = np.array([p["x"] for p in points])
            ctrl_y = np.array([p["y"] for p in points])

            # Sort in case input is not sorted
            sort_idx = np.argsort(ctrl_x)
            ctrl_x = ctrl_x[sort_idx]
            ctrl_y = ctrl_y[sort_idx]

            # Ensure unique x values (interp1d requires this)
            unique_x, unique_indices = np.unique(ctrl_x, return_index=True)
            unique_y = ctrl_y[unique_indices]

            n_points = len(unique_x)
            if n_points >= 4:
                kind = 'cubic'
            elif n_points == 3:
                kind = 'quadratic'
            elif n_points == 2:
                kind = 'linear'
            else:
                kind = None

            if kind:
                interpolator = interp1d(unique_x, unique_y, kind=kind, fill_value="extrapolate", bounds_error=False)
                dense_x = np.linspace(0, 1, 200)
                dense_y = interpolator(dense_x)
                curve_points = np.stack([dense_x, dense_y], axis=1).tolist()
            else:
                dense_x = np.linspace(0, 1, 200)
                dense_y = np.full_like(dense_x, unique_y[0] if len(unique_y) > 0 else 0.0)
                curve_points = np.stack([dense_x, dense_y], axis=1).tolist()

        # Compose output
        out_data = {
            "control_points": points,
            "spline_points": curve_points,
        }

        # --- Generate sigmas tensor ---
        curve_points_arr = np.array(curve_points)
        curve_x = curve_points_arr[:, 0]
        curve_y = curve_points_arr[:, 1]
        sort_idx = np.argsort(curve_x)
        curve_x = curve_x[sort_idx]
        curve_y = curve_y[sort_idx]
        sigma_interp = interp1d(curve_x, curve_y, kind="linear", fill_value="extrapolate", bounds_error=False)
        sigma_x = np.linspace(0, 1, steps)
        sigma_y = sigma_interp(sigma_x)
        sigmas = torch.tensor(sigma_y, dtype=torch.float32)

        # --- Scale and shift the sigmas to match desired start_y and end_y ---
        if steps >= 2:
            src_start = sigmas[0].item()
            src_end = sigmas[-1].item()
            if abs(src_end - src_start) > 1e-8:
                scale = (end_y - start_y) / (src_end - src_start)
                shift = start_y - src_start * scale
                sigmas = sigmas * scale + shift
            else:
                sigmas = torch.full((steps,), start_y, dtype=torch.float32)

        return (
            json.dumps(out_data),
            sigmas
        )
    
    def onSerialize(self):
        # This is called when the node is being saved to a workflow file
        # We should return any extra data we want saved
        if hasattr(self, 'cached_control_points'):
            return {"curve_state": self.cached_control_points}
        return {}

    def onDeserialize(self, data):
        # This is called when the node is being loaded from a workflow file
        # We should process any extra data that was saved
        if "curve_state" in data:
            self.cached_control_points = data["curve_state"]

NODE_CLASS_MAPPINGS = {"CustomSplineSigma": CustomSplineSigma}
NODE_DISPLAY_NAME_MAPPINGS = {"CustomSplineSigma": "📈 Custom Graph Sigma"}