import bpy
import json
import math
import runpy
import time
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
COURT = {'west': -8.0, 'east': 20.0, 'south': -14.0, 'north': 14.0, 'rear_chamfer': 8.0}
DIAGONAL = math.sqrt(.5)
PLACEMENTS = {
    'codex': (-4-5.3*DIAGONAL, 10+5.3*DIAGONAL, 45),
    'stash': (-13.5, -5, 90),
    'workshop': (16+6.7*DIAGONAL, 10+6.7*DIAGONAL, -45),
    'bazaar': (27.8, -5, -90),
}


def apply_layout():
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'checkpoints'/('before-layout-'+str(time.time_ns())+'.blend')),copy=True)
    for key,(x,y,angle) in PLACEMENTS.items():
        obj=bpy.data.objects[key]
        obj.location=(x,y,0)
        obj.rotation_euler=(0,0,math.radians(angle))
    bpy.context.view_layer.update()
    build=runpy.run_path(str(ROOT/'scripts/build_scene.py'))
    build['setup_materials']()
    env=build['box'].__globals__
    for obj in list(bpy.data.objects):
        if obj.get('respite_layout'):
            bpy.data.objects.remove(obj,do_unlink=True)
    env['CURRENT_COLLECTION']=bpy.data.collections['Respite.ground']
    env['CURRENT_ROOT']=bpy.data.objects['ground']

    def polygon(name,points,mat='floor',height=-.017):
        area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1]))
        if area<0: points=list(reversed(points))
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata([(x,y,height) for x,y in points],[],[tuple(range(len(points)))])
        mesh.update()
        obj=bpy.data.objects.new(name,mesh)
        env['CURRENT_COLLECTION'].objects.link(obj)
        obj=build['finish'](obj,name,mat)
        obj['respite_layout']=True
        return obj

    def line(name,a,b,width=.035,mat='joint',height=-.006):
        direction=Vector((b[0]-a[0],b[1]-a[1]))
        normal=Vector((-direction.y,direction.x)).normalized()*width/2
        return polygon(name,[(a[0]+normal.x,a[1]+normal.y),(a[0]-normal.x,a[1]-normal.y),(b[0]-normal.x,b[1]-normal.y),(b[0]+normal.x,b[1]+normal.y)],mat,height)

    for obj in list(bpy.data.collections['Respite.ground'].objects):
        if obj.name.startswith('ground.court-inlay'):
            bpy.data.objects.remove(obj,do_unlink=True)
    w,e,s,n=(COURT[key] for key in ('west','east','south','north'))
    chamfer=COURT['rear_chamfer']
    polygon('common-court',[(w,s),(e,s),(e,n-chamfer),(e-chamfer,n),(w+chamfer,n),(w,n-chamfer)])
    polygon('tunnel-apron',[(1,n),(11,n),(11,24),(1,24)])
    for x in (w+3,e-3):
        line('perimeter-walk-joint'+str(x),(x,s),(x,n-chamfer),.10,'roof')
    line('rear-west-walk',(w+3,n-chamfer),(w+chamfer,n-3),.10,'roof')
    line('rear-east-walk',(e-3,n-chamfer),(e-chamfer,n-3),.10,'roof')
    for row,y in enumerate(range(-14,14,2)):
        inset=max(0,y-(n-chamfer))
        line('court-bed'+str(y),(w+inset,y),(e-inset,y))
        next_inset=max(0,y+2-(n-chamfer))
        for x in range(-8+(row%2)*2,21,4):
            if w+next_inset<x<e-next_inset:
                line('court-joint'+str((x,y)),(x,y),(x,y+2))
    for y in (15,17,19,21,23): line('apron-joint'+str(y),(1,y),(11,y))

    camera=bpy.data.objects['Court']
    target=Vector((6,4,5.5))
    camera.location=(6,-50,41)
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera['respite_orbit_distance']=(target-camera.location).length
    camera.data.lens=27
    plan=bpy.data.objects['Plan']
    plan.location=(6,5,100)
    plan.rotation_euler=(0,0,0)
    plan.data.ortho_scale=65
    plan['respite_orbit_distance']=100
    bpy.context.scene.camera=camera
    bpy.context.scene['respite_court_bounds']=json.dumps(COURT)
    bpy.context.view_layer.update()
    runpy.run_path(str(ROOT/'scripts/bake_materials.py'))['apply_textures'](['ground'])
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'scenes/respite.blend'))
    print(json.dumps({'court':COURT,'placements':PLACEMENTS}))


if __name__=='__main__':
    apply_layout()
