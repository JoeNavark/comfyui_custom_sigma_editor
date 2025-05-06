# 📈 Custom Graph Sigma for ComfyUI

**Custom Graph Sigma** is a ComfyUI custom node that provides an interactive spline-based curve editor for visually creating and exporting custom sigma schedules. This is especially useful for controlling the noise schedule or custom step values in diffusion models and other workflows that use a sequence of values over time or steps.

## Features

- 🖱️ **Interactive Graph Editor:**  
  Add, move, or delete control points directly on the node’s graph, shaping your curve in real time.
- 🟦 **Smooth Catmull-Rom Spline:**  
  Uses a centripetal Catmull-Rom spline for smooth and predictable interpolation between points.
- 📤 **Export Schedules as Tensors:**  
  Outputs your custom curve as a tensor of sigma values for use in scheduling, denoising, or other pipeline steps.
- 👀 **Visual Feedback:**  
  Node displays a live preview of your curve and control points for precise tuning.

## Usage

1. Add the **Custom Graph Sigma** node to your ComfyUI workflow.
2. Use the graph area to add control points (click), move them (drag), or remove them (shift+click).
3. Adjust the `steps` parameter to set how many values are exported.
4. Connect the node’s outputs to schedule or denoising nodes as needed.

MIT License. Visit the [Open Source Initiative MIT page](https://opensource.org/licenses/MIT).

