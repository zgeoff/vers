import bpy
import json
import math
import runpy
import time
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
PLACEMENTS={
    'codex':(-11,17,0),
    'stash':(-18,1,90),
    'workshop':(25,16,-15),
    'bazaar':(22,-3.5,-90),
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

    def tag(obj):
        obj['respite_layout']=True
        return obj

    def box(name,center,size,mat='roof',bevel=.06):
        return tag(build['box'](name,center,size,mat,bevel))

    def polygon(name,points,mat='floor',height=-.017):
        signed_area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1]))
        if signed_area<0: points=list(reversed(points))
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata([(x,y,height) for x,y in points],[],[tuple(range(len(points)))])
        mesh.update()
        obj=bpy.data.objects.new(name,mesh)
        env['CURRENT_COLLECTION'].objects.link(obj)
        return tag(build['finish'](obj,name,mat))

    def line(name,a,b,width=.16,mat='roof',height=-.010):
        direction=Vector((b[0]-a[0],b[1]-a[1]))
        normal=Vector((-direction.y,direction.x)).normalized()*width/2
        return polygon(name,[(a[0]+normal.x,a[1]+normal.y),(a[0]-normal.x,a[1]-normal.y),(b[0]-normal.x,b[1]-normal.y),(b[0]+normal.x,b[1]+normal.y)],mat,height)

    # Flush paving defines one forecourt and the short approach from the passage.
    polygon('arrival-paving',[(1,8.1),(11,8.1),(11,24),(1,24)],'floor',-.012)
    for x in (1,11): line('arrival-edge'+str(x),(x,8.35),(x,22.3),.28,'roof')
    for y in (12,16,20,22): line('arrival-joint'+str(y),(1,y),(11,y),.035,'joint',-.007)
    line('north-court-edge-west',(-13,8.1),(1,8.1),.28,'roof')
    line('north-court-edge-east',(11,8.1),(17,8.1),.28,'roof')
    # Replace the detached circle with a centered, flush court boundary.
    for obj in list(bpy.data.collections['Respite.ground'].objects):
        if obj.name.startswith('ground.court-inlay'):
            bpy.data.objects.remove(obj,do_unlink=True)
    court=[(-9,-8),(-9,8.1),(11,8.1),(11,-8),(7,-12),(-5,-12)]
    polygon('common-court',court,'floor',-.013)
    center=Vector((1,-1))
    inner=[tuple(center+(Vector(p)-center)*.965) for p in court]
    for i,a in enumerate(court):
        j=(i+1)%len(court)
        polygon('court-boundary'+str(i),[a,court[j],inner[j],inner[i]],'roof',-.006)
    for y in (-8,-4,0,4):
        left=-9
        right=11
        line('court-paver-bed'+str(y),(left,y),(right,y),.028,'joint',-.004)
        for x in (-5,1,7):
            line('court-paver-joint'+str((x,y)),(x,y),(x,y+4),.025,'joint',-.004)
    for x,y in ((-12,6.8),(14,6.8)):
        box('drain-frame'+str(x),(x,y,-.015),(1.35,.55,.035),'dark',.01)
        for i in range(7): box('drain-bar'+str((x,i)),(x-.54+i*.18,y,.008),(.055,.51,.02),'roof',0)

    env['CURRENT_COLLECTION']=bpy.data.collections['Respite.habitat']
    env['CURRENT_ROOT']=bpy.data.objects['habitat']
    box('west-service-block',(-24,12,2.8),(14,10,5.6),'wall',.14)
    box('west-service-roof',(-24,12,5.66),(14.4,10.4,.3),'roof',.08)
    box('west-court-wall',(-17,9.5,1.6),(.65,5.8,3.2),'wall',.08)
    box('west-court-cap',(-17,9.5,3.26),(.8,6.0,.18),'roof',.04)
    box('west-corner-return',(-16,12.1,1.6),(2.5,.65,3.2),'wall',.07)
    box('west-background-base',(-39,24,3.5),(30,10,7),'wall',.15)
    box('west-background-course',(-39,18.8,6.6),(30,.5,.45),'roof')
    for x in (-29,-23):
        box('west-service-window-frame'+str(x),(x,6.94,3.8),(2.4,.14,.65),'dark',.03)
        box('west-service-window'+str(x),(x,6.85,3.8),(2.15,.04,.43),'glass',.02)
    tag(build['pipe']('shared-west-conduit',[(-30,17,5.3),(-30,17,7.0),(-17,17,7.0),(-17,20,7.0),(-15.6,20,7.0)],.28))
    for x in (-29,-24,-19): box('west-conduit-bracket'+str(x),(x,17,6.4),(.12,.6,1.5),'dark',.02)
    for x,y,length in ((-15.8,7.0,2.8),(15.8,13.3,2.5)):
        box('perimeter-bench-base'+str(x),(x,y,.36),(length,.65,.72),'wall',.08)
        box('perimeter-bench-top'+str(x),(x,y,.77),(length+.12,.79,.12),'roof',.04)

    box('east-service-wall',(31,7,1.15),(.65,10,2.3),'wall',.08)
    box('east-service-cap',(31,7,2.38),(.85,10.2,.2),'roof',.04)
    box('east-workshop-return',(29.2,12,1.15),(4.2,.65,2.3),'wall',.08)
    workshop_port=bpy.data.objects['workshop'].matrix_world@Vector((-1.8,4.2,7.05))
    tag(build['pipe']('workshop-shared-feed',[(22,21.5,18),(workshop_port.x,21.5,18),(workshop_port.x,workshop_port.y,18),tuple(workshop_port)],.45))

    camera=bpy.data.objects['Court']
    target=Vector((3,6,3.8))
    camera.location=(3,-37,42)
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera['respite_orbit_distance']=(target-camera.location).length
    camera.data.lens=27
    for name,position,look_at,lens in [('Arrival',(6,21.5,7),(2,-2,1.5),18),('Court-close',(2,-36,27),(3,7,2.5),25)]:
        old=bpy.data.objects.get(name)
        if old: bpy.data.objects.remove(old,do_unlink=True)
        env['CURRENT_COLLECTION']=bpy.data.collections['Respite.presentation']
        tag(build['camera'](name,position,look_at,lens))
    plan=bpy.data.objects['Plan'];plan.location=(3,5,100);plan.data.ortho_scale=70
    plan.rotation_euler=(0,0,0)
    plan['respite_orbit_distance']=100
    bpy.context.scene.camera=camera
    bpy.context.view_layer.update()
    runpy.run_path(str(ROOT/'scripts/bake_materials.py'))['apply_textures'](['ground','habitat'])
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'scenes/respite.blend'))
    print(json.dumps({'layout':PLACEMENTS,'camera':list(camera.location)}))


if __name__=='__main__':
    apply_layout()
