import torch
import numpy as np
import json
from scipy.interpolate import interp1d

class SigmaJoiner:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "sigma_1": ("SIGMAS",),
                "sigma_2": ("SIGMAS",),
            }
        }

    RETURN_TYPES = ("SIGMAS",)
    FUNCTION = "join_sigmas"
    CATEGORY = "sampling/custom"

    def join_sigmas(self, sigma_1, sigma_2):
        import torch
        
        # Basic case - if sigmas are just tensors
        if isinstance(sigma_1, torch.Tensor) and isinstance(sigma_2, torch.Tensor):
            # Remove first element from second array to avoid duplication at junction
            sigma_2_trimmed = sigma_2[1:] if len(sigma_2) > 0 else sigma_2
            
            # Combine the two sigma arrays
            combined_sigma = torch.cat([sigma_1, sigma_2_trimmed], dim=0)
            
            # Sort the sigmas in descending order (important for sampling)
            combined_sigma, _ = torch.sort(combined_sigma, descending=True)
            
            return (combined_sigma,)
            
        # If sigmas are dictionaries or have additional attributes
        elif hasattr(sigma_1, '__dict__') or isinstance(sigma_1, dict):
            # Try to handle dictionary-like sigma objects
            if isinstance(sigma_1, dict):
                combined_sigma = sigma_1.copy()  # Make a copy of the first sigma
            else:
                import copy
                combined_sigma = copy.deepcopy(sigma_1)
                
            # Get the underlying tensor values
            if hasattr(sigma_1, 'sigmas') and hasattr(sigma_2, 'sigmas'):
                tensor1 = sigma_1.sigmas
                tensor2 = sigma_2.sigmas
            elif isinstance(sigma_1, dict) and 'sigmas' in sigma_1 and 'sigmas' in sigma_2:
                tensor1 = sigma_1['sigmas'] 
                tensor2 = sigma_2['sigmas']
            else:
                # Try to find tensor attributes
                tensor1 = next((v for k, v in vars(sigma_1).items() if isinstance(v, torch.Tensor)), None)
                tensor2 = next((v for k, v in vars(sigma_2).items() if isinstance(v, torch.Tensor)), None)
                
                if tensor1 is None or tensor2 is None:
                    # Fallback - assume the objects themselves are tensors or tensor-like
                    tensor1 = sigma_1
                    tensor2 = sigma_2
            
            # Join the tensors
            tensor2_trimmed = tensor2[1:] if len(tensor2) > 0 else tensor2
            combined_tensor = torch.cat([tensor1, tensor2_trimmed], dim=0)
            combined_tensor, _ = torch.sort(combined_tensor, descending=True)
            
            # Update the tensor in the combined object
            if hasattr(combined_sigma, 'sigmas'):
                combined_sigma.sigmas = combined_tensor
            elif isinstance(combined_sigma, dict) and 'sigmas' in combined_sigma:
                combined_sigma['sigmas'] = combined_tensor
                
            # Handle special case for cfg_sigmas_i dictionary
            if hasattr(combined_sigma, 'cfg_sigmas_i'):
                # Rebuild the cfg_sigmas_i dictionary with proper indices
                combined_sigma.cfg_sigmas_i = {i: combined_tensor[i].item() for i in range(len(combined_tensor))}
            elif isinstance(combined_sigma, dict) and 'cfg_sigmas_i' in combined_sigma:
                combined_sigma['cfg_sigmas_i'] = {i: combined_tensor[i].item() for i in range(len(combined_tensor))}
                
            # Update any size or length attributes
            if hasattr(combined_sigma, 'size') or hasattr(combined_sigma, 'length'):
                if hasattr(combined_sigma, 'size'):
                    combined_sigma.size = len(combined_tensor)
                if hasattr(combined_sigma, 'length'):
                    combined_sigma.length = len(combined_tensor)
            
            return (combined_sigma,)
            
        else:
            # Default fallback - treat as tensors
            return self.join_sigmas(torch.tensor(sigma_1), torch.tensor(sigma_2))


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
                "start_y": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 20, "step": 0.01}),
                "end_y": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 20, "step": 0.01}),
                "curve_data": ("STRING", {"default": "", "forceInput": True}),
            }
        }

    def __init__(self):
        pass

    def render(self, steps, curve_data="", start_y=1.0, end_y=0.0):
        # --- Parse curve_data for control_points and samples ---
        try:
            data = json.loads(curve_data) if curve_data else {}
            points = data.get(
                "control_points", 
                [
                    {"x": 0.0, "y": start_y},
                    {"x": 1.0, "y": end_y}
                ]
            )
            samples = data.get("samples", None)
        except Exception as e:
            print(f"[CustomSplineSigma] Bad input: {str(e)}")
            samples = None
            points = [
                {"x": 0.0, "y": start_y},
                {"x": 1.0, "y": end_y}
            ]

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

NODE_CLASS_MAPPINGS = {
    "CustomSplineSigma": CustomSplineSigma,
    "SigmaJoiner": SigmaJoiner
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CustomSplineSigma": "📈 Custom Graph Sigma",
    "SigmaJoiner": "Join Sigma Values"
}