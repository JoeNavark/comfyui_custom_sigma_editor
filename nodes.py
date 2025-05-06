import torch
import numpy as np
import json
from PIL import Image, ImageDraw
from scipy.interpolate import interp1d

class CustomSplineSigma:
    CATEGORY = "image/generator"
    RETURN_TYPES = ("IMAGE", "JSON", "STRING", "SIGMAS")
    RETURN_NAMES = ("image", "curve_data", "description", "sigmas")
    FUNCTION = "render"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "curve_data": ("STRING", {"default": ""}),
                "steps": ("INT", {"default": 20, "min": 2, "max": 4096})
            }
        }

    def __init__(self):
        pass

    def render(self, curve_data, steps):
        # --- Parse curve_data for control_points and samples ---
        try:
            data = json.loads(curve_data) if curve_data else {}
            samples = data.get("samples", None)
            points = data.get("control_points", [{"x": 0.0, "y": 1.0}, {"x": 1.0, "y": 0.0}])
        except Exception as e:
            print(f"[CubicSplineCurveRenderer] Bad input: {str(e)}")
            samples = None
            points = [{"x": 0.0, "y": 1.0}, {"x": 1.0, "y": 0.0}]

        # --- Use JS samples if available for pixel-perfect match ---
        if samples and isinstance(samples, list) and len(samples) > 1:
            curve_points = samples
            description = "Curve drawn from JS Catmull-Rom samples (pixel-perfect match)"
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
                description = f"{kind.capitalize()} interpolation using scipy.interpolate.interp1d"
            else:
                dense_x = np.linspace(0, 1, 200)
                dense_y = np.full_like(dense_x, unique_y[0] if len(unique_y) > 0 else 0.0)
                curve_points = np.stack([dense_x, dense_y], axis=1).tolist()
                description = "Constant value; not enough points to interpolate"

        # --- Draw image ---
        width, height = 512, 512
        img = Image.new("RGB", (width, height), "#FFFFFF")
        draw = ImageDraw.Draw(img)

        # Draw grid
        for i in range(1, 4):
            x_pos = int(width * i / 4)
            draw.line([(x_pos, 0), (x_pos, height)], fill="#EEEEEE")
            y_pos = int(height * i / 4)
            draw.line([(0, y_pos), (width, y_pos)], fill="#EEEEEE")

        # Draw axes
        draw.line([(0, height-1), (width-1, height-1)], fill="#AAAAAA", width=2)
        draw.line([(0, height-1), (0, 0)], fill="#AAAAAA", width=2)

        # Draw curve (from curve_points)
        prev = curve_points[0]
        prev_x = int(prev[0] * (width - 1))
        prev_y = int((1 - prev[1]) * (height - 1))
        for pt in curve_points[1:]:
            curr_x = int(pt[0] * (width - 1))
            curr_y = int((1 - pt[1]) * (height - 1))
            draw.line([(prev_x, prev_y), (curr_x, curr_y)], fill="#3366FF", width=3)
            prev_x, prev_y = curr_x, curr_y

        # Draw control points (always shown)
        for p in points:
            px = int(p['x'] * (width - 1))
            py = int((1 - p['y']) * (height - 1))
            draw.ellipse([(px-5, py-5), (px+5, py+5)], fill="#FF5555", outline="#880000")

        # Compose output (include both for reference)
        out_data = {
            "control_points": points,
            "spline_points": curve_points,
        }

        # --- Generate sigmas tensor ---
        # Interpolate the curve at `steps` evenly spaced points from x=0 to x=1
        curve_points_arr = np.array(curve_points)
        curve_x = curve_points_arr[:, 0]
        curve_y = curve_points_arr[:, 1]
        # Ensure curve_x is sorted (should be, but just in case)
        sort_idx = np.argsort(curve_x)
        curve_x = curve_x[sort_idx]
        curve_y = curve_y[sort_idx]
        # Interpolator for sampling
        sigma_interp = interp1d(curve_x, curve_y, kind="linear", fill_value="extrapolate", bounds_error=False)
        sigma_x = np.linspace(0, 1, steps)
        sigma_y = sigma_interp(sigma_x)
        sigmas = torch.tensor(sigma_y, dtype=torch.float32)

        return (
            torch.from_numpy(np.array(img).astype(np.float32) / 255.0).unsqueeze(0),
            json.dumps(out_data),
            description,
            sigmas
        )

NODE_CLASS_MAPPINGS = {"CustomSplineSigma": CustomSplineSigma}
NODE_DISPLAY_NAME_MAPPINGS = {"CuustomSplineSigma": "📈 Custom Graph Sigma"}