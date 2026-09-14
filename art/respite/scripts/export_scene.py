import bpy
import json
import math
import os
import time
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
KEYS = ('codex', 'stash', 'workshop', 'bazaar', 'exit', 'habitat', 'ground')


def to_three(vec):
    return [round(vec[0], 6), round(vec[2], 6), round(-vec[1], 6)]


def export_scene(keys=None):
    output = ROOT / 'exports'
    output.mkdir(exist_ok=True)
    manifest_path = output / 'scene.json'
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    assets = {a['id']: a for a in old.get('assets', [])}
    selection = list(bpy.context.selected_objects)
    active = bpy.context.view_layer.objects.active
    for key in keys or KEYS:
        root = bpy.data.objects[key]
        matrix = root.matrix_world.copy()
        parts = [o for o in root.children_recursive if o.type == 'MESH' and not o.hide_render]
        temporary_objects=[]
        temporary_meshes=[]
        try:
            bpy.ops.object.select_all(action='DESELECT')
            root.matrix_world = Matrix.Identity(4)
            bpy.context.view_layer.update()
            depsgraph=bpy.context.evaluated_depsgraph_get()
            groups={}
            for obj in parts:
                belongs_to_door='open-vault-leaf' in obj.name or any('open-vault-leaf' in p.name for p in ancestors(obj))
                group_key='vault-door' if belongs_to_door else 'static'
                mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph),preserve_all_data_layers=True,depsgraph=depsgraph)
                temporary_meshes.append(mesh)
                clone=bpy.data.objects.new('export-temporary',mesh)
                bpy.context.scene.collection.objects.link(clone)
                clone.matrix_world=obj.matrix_world.copy()
                temporary_objects.append(clone)
                groups.setdefault(group_key,[]).append(clone)
            joined=[]
            for group_key,clones in groups.items():
                bpy.ops.object.select_all(action='DESELECT')
                for clone in clones: clone.select_set(True)
                bpy.context.view_layer.objects.active=clones[0]
                bpy.ops.object.join()
                composite=bpy.context.object
                composite.name=key+'.'+group_key
                composite_matrix=composite.matrix_world.copy()
                composite.parent=root
                composite.matrix_world=composite_matrix
                joined.append(composite)
            bpy.ops.object.select_all(action='DESELECT')
            for obj in joined: obj.select_set(True)
            root.select_set(True)
            bpy.context.view_layer.objects.active=root
            temporary = output / (key + '.pending.glb')
            bpy.ops.export_scene.gltf(filepath=str(temporary), export_format='GLB', use_selection=True,
                                      export_apply=True, export_extras=True, export_cameras=False,
                                      export_lights=False, export_animations=False)
            os.replace(temporary, output / (key + '.glb'))
        finally:
            for obj in temporary_objects:
                try: bpy.data.objects.remove(obj,do_unlink=True)
                except ReferenceError: pass
            for mesh in temporary_meshes:
                try:
                    if mesh.users==0: bpy.data.meshes.remove(mesh)
                except ReferenceError: pass
            root.matrix_world = matrix
            bpy.context.view_layer.update()
        assets[key] = {'id':key, 'file':key+'.glb', 'position':to_three(matrix.translation),
                       'rotationY':root.rotation_euler.z, 'scale':list(root.scale),
                       'interactive':key in KEYS[:5], 'bytes':(output/(key+'.glb')).stat().st_size}
    bpy.ops.object.select_all(action='DESELECT')
    for obj in selection:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active
    cameras = {}
    aspect = bpy.context.scene.render.resolution_x / bpy.context.scene.render.resolution_y
    for name in ('Court','Court-alternate','Plan'):
        obj = bpy.data.objects[name]
        cameras[name] = {'position':to_three(obj.location),
                         'target':to_three(obj.location + obj.rotation_euler.to_quaternion() @ Vector((0,0,-50))),
                         'fov':math.degrees(2*math.atan(obj.data.sensor_width/(2*obj.data.lens*aspect))),
                         'type':obj.data.type,'orthoScale':obj.data.ortho_scale,'aspect':aspect}
    manifest = {'revision':time.time_ns(),'units':'meters','assets':list(assets.values()),'cameras':cameras}
    temporary = manifest_path.with_suffix('.pending.json')
    temporary.write_text(json.dumps(manifest,indent=2)+'\n')
    os.replace(temporary,manifest_path)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'scenes/respite.blend'))
    print(json.dumps({'exported':list(keys or KEYS),'bytes':sum(a['bytes'] for a in assets.values())}))
    return manifest


def ancestors(obj):
    parent=obj.parent
    while parent:
        yield parent
        parent=parent.parent


if __name__ == '__main__':
    export_scene()
