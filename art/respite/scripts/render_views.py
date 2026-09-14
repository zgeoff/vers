import bpy
import json
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def schedule(views, percentage=75, samples=32):
    queue = list(views)
    completed = []
    scene = bpy.context.scene
    scene.render.resolution_percentage = percentage
    scene.cycles.samples = samples
    status_path = ROOT / 'renders/job.json'
    status_path.write_text(json.dumps({'state':'scheduled','queue':queue}))

    def render_next():
        if not queue:
            status_path.write_text(json.dumps({'state':'complete','completed':completed}))
            return None
        camera_name, filename = queue.pop(0)
        try:
            scene.camera = bpy.data.objects[camera_name]
            scene.render.filepath = str(ROOT / 'renders' / filename)
            status_path.write_text(json.dumps({'state':'running','current':filename,'completed':completed}))
            bpy.ops.render.render(write_still=True)
            completed.append(filename)
            status_path.write_text(json.dumps({'state':'between','completed':completed,'remaining':queue}))
        except Exception:
            status_path.write_text(json.dumps({'state':'failed','completed':completed,'error':traceback.format_exc()}))
            return None
        return 1.0

    bpy.app.timers.register(render_next, first_interval=1.0)
    print(json.dumps({'scheduled':queue}))
