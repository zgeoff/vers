import bpy
import json
import math
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[1]
DESTINATIONS=('codex','stash','workshop','bazaar','exit')


def check_layout():
    scene=bpy.context.scene
    depsgraph=bpy.context.evaluated_depsgraph_get()
    camera=bpy.data.objects['Court']
    targets={
        'codex':(0,-5.7,1.5),
        'stash':(.55,-5.7,1.5),
        'workshop':(-3.65,-6.2,1.5),
        'bazaar':(0,-8.0,1.5),
        'exit':(0,-1.9,2),
    }

    def ray(a,b):
        direction=b-a
        hit,point,normal,index,obj,matrix=scene.ray_cast(depsgraph,a,direction.normalized(),distance=max(0,direction.length-.04))
        return {'clear':not hit,'obstacle':obj.name if hit else None,'point':list(point) if hit else None}

    entrances={}
    framing={}
    facing={}
    center=Vector((6,0,0))
    for key in DESTINATIONS:
        root=bpy.data.objects[key]
        target=Vector(targets[key])
        width=.65 if key=='stash' else 1.0
        if key=='exit': width=6
        if key=='bazaar': width=4
        samples=[]
        for dx in (-width/2,0,width/2):
            for dz in (-.65,0,.65):
                point=root.matrix_world@(target+Vector((dx,0,dz)))
                samples.append(ray(camera.location,point))
        entrances[key]={'clear_samples':sum(s['clear'] for s in samples),'samples':samples}
        projected=[]
        for obj in root.children_recursive:
            if obj.type!='MESH' or obj.hide_render: continue
            evaluated=obj.evaluated_get(depsgraph)
            for v in evaluated.data.vertices:
                projected.append(world_to_camera_view(scene,camera,obj.matrix_world@v.co))
        framing[key]={
            'min':[min(p[i] for p in projected) for i in (0,1)],
            'max':[max(p[i] for p in projected) for i in (0,1)],
            'inside':all(0<=p.x<=1 and 0<=p.y<=1 and p.z>0 for p in projected),
        }
        threshold=root.matrix_world@target
        toward=center-threshold;toward.z=0
        normal=root.rotation_euler.to_quaternion()@Vector((0,-1,0))
        facing[key]={'toward_court_dot':normal.dot(toward.normalized()),'threshold':list(threshold)}
    routes={}
    for key in DESTINATIONS:
        if key=='exit': continue
        endpoint=bpy.data.objects[key].matrix_world@Vector(targets[key])
        local_approach=Vector(targets[key]);local_approach.y-=1.6
        approach=bpy.data.objects[key].matrix_world@local_approach
        route=[Vector((6,22.0,1)),Vector((6,14,1)),Vector((6,0,1)),Vector((approach.x,approach.y,1)),Vector((endpoint.x,endpoint.y,1))]
        if key=='bazaar':
            inner=bpy.data.objects['bazaar'].matrix_world@Vector((0,-1,1));route.append(inner)
        results=[]
        for a,b in zip(route,route[1:]):
            sideways=Vector((-(b-a).y,(b-a).x,0)).normalized()
            for offset in (-.35,0,.35):
                for height in (.7,1.7):
                    aa=a+sideways*offset;bb=b+sideways*offset;aa.z=height;bb.z=height
                    results.append(ray(aa,bb))
        routes[key]={'clear':all(r['clear'] for r in results),'segments':results,'points':[list(p) for p in route]}
    wall=bpy.data.objects['habitat.continuous-wall'].evaluated_get(depsgraph)
    housing=bpy.data.objects['habitat.passage-housing'].evaluated_get(depsgraph)
    wall_samples=[]
    for x in (-60,-40,-20,-8,20,40,60):
        for z in (2,8,15):
            origin=Vector((x,20,z))
            hit,point,normal,index=wall.ray_cast(wall.matrix_world.inverted()@origin,Vector((0,1,0)),distance=40)
            wall_samples.append({'x':x,'z':z,'solid':hit})
    roof_samples=[]
    for y in (28,40,50):
        block=wall if y<32 else housing
        origin=Vector((6,y,30))
        hit,point,normal,index=block.ray_cast(block.matrix_world.inverted()@origin,Vector((0,0,-1)),distance=30)
        roof_samples.append({'y':y,'covered':hit,'height':(block.matrix_world@point).z if hit else None})
    clear_bores=[]
    for block in (wall,housing):
        hit,point,normal,index=block.ray_cast(block.matrix_world.inverted()@Vector((6,20,5.45)),Vector((0,1,0)),distance=40)
        clear_bores.append({'object':block.name,'clear':not hit})
    enclosure={'solid_wall':wall_samples,'covered_passage':roof_samples,'clear_bore':clear_bores}
    report={'camera':camera.name,'framing':framing,'entrances':entrances,'facing':facing,'routes':routes,
            'bazaar':{'outer_dimensions_m':[17,15],'wing_depth_m':3,'clear_court_width_m':11,'gateway_clear_width_m':5.9,'walls':'three wings and two returns'},
            'units':scene.unit_settings.system,'file':bpy.data.filepath,'enclosure':enclosure}
    (ROOT/'renders/plaza-layout-check.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'framing':{k:v['inside'] for k,v in framing.items()},'entrance_clear_samples':{k:v['clear_samples'] for k,v in entrances.items()},'routes':{k:v['clear'] for k,v in routes.items()},'facing':{k:round(v['toward_court_dot'],3) for k,v in facing.items()}}))
    return report


if __name__=='__main__':
    check_layout()
