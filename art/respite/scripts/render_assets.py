import bpy
import json
import traceback
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]


def schedule_assets(keys=('stash','workshop','bazaar','exit'), revision='0008'):
    scene=bpy.context.scene
    old_camera=scene.camera
    hidden={c.name:c.hide_render for c in bpy.data.collections if c.name.startswith('Respite.')}
    queue=[(key,view) for key in keys for view in ('study','reverse')]
    completed=[]
    cam=bpy.data.objects.get('Asset-review')
    if not cam:
        cam=bpy.data.objects.new('Asset-review',bpy.data.cameras.new('Asset-review'))
        bpy.data.collections['Respite.presentation'].objects.link(cam)
        cam['respite_generated']=True
    cam.data.lens=48
    scene.render.resolution_percentage=100
    scene.cycles.samples=48
    status=ROOT/'renders/asset-job.json'

    def restore():
        scene.camera=old_camera
        for name,value in hidden.items():
            if name in bpy.data.collections: bpy.data.collections[name].hide_render=value

    def render_next():
        if not queue:
            restore()
            status.write_text(json.dumps({'state':'complete','completed':completed}))
            return None
        key,view=queue.pop(0)
        try:
            for name in hidden:
                bpy.data.collections[name].hide_render=name not in ('Respite.'+key,'Respite.ground','Respite.presentation')
            if key=='exit': bpy.data.collections['Respite.habitat'].hide_render=False
            asset=bpy.data.objects[key]
            bpy.context.view_layer.update()
            dims={'codex':(16,23,14,4),'stash':(17,24,14,2.5),'workshop':(19,26,16,3.5),
                  'bazaar':(19,26,20,2),'exit':(22,32,20,7)}[key]
            x,y,z,target_z=dims
            local=(-x,-y,z) if view=='reverse' else (x,-y,z)
            cam.location=asset.matrix_world @ Vector(local)
            target=asset.matrix_world @ Vector((0,0,target_z))
            cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
            scene.camera=cam
            filename=f'{key}-{view}-{revision}.png'
            scene.render.filepath=str(ROOT/'renders'/filename)
            status.write_text(json.dumps({'state':'running','current':filename,'completed':completed}))
            bpy.ops.render.render(write_still=True)
            completed.append(filename)
        except Exception:
            restore()
            status.write_text(json.dumps({'state':'failed','error':traceback.format_exc(),'completed':completed}))
            return None
        return 1.0

    status.write_text(json.dumps({'state':'scheduled','queue':queue}))
    bpy.app.timers.register(render_next,first_interval=1)
    print(json.dumps({'scheduled':queue}))


if __name__=='__main__': schedule_assets()
