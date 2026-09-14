import bpy
import math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PALETTE={
    'shell':(.24,.255,.29), 'trim':(.32,.335,.365), 'roof':(.16,.18,.22),
    'dark':(.065,.077,.10), 'floor':(.18,.195,.23), 'wall':(.13,.15,.19), 'fabric':(.17,.095,.19),
}


def bake_materials():
    folder=ROOT/'textures'
    folder.mkdir(exist_ok=True)
    scene=bpy.context.scene
    previous_samples=scene.cycles.samples
    previous_device=scene.cycles.device
    scene.cycles.samples=1
    scene.cycles.device='CPU'
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,-10))
    plane=bpy.context.object
    plane.name='Respite-texture-bake-temporary'
    try:
        for name,base in PALETTE.items():
            mat=bpy.data.materials.new('Bake-temporary')
            mat.use_nodes=True
            nodes=mat.node_tree.nodes
            links=mat.node_tree.links
            nodes.clear()
            output=nodes.new('ShaderNodeOutputMaterial')
            emission=nodes.new('ShaderNodeEmission')
            uv=nodes.new('ShaderNodeTexCoord')
            separate=nodes.new('ShaderNodeSeparateXYZ')
            links.new(uv.outputs['UV'],separate.inputs[0])
            combine=nodes.new('ShaderNodeCombineXYZ')
            periodic=[]
            for axis in ('X','Y'):
                angle=nodes.new('ShaderNodeMath')
                angle.operation='MULTIPLY'
                angle.inputs[1].default_value=math.tau
                links.new(separate.outputs[axis],angle.inputs[0])
                for operation in ('SINE','COSINE'):
                    node=nodes.new('ShaderNodeMath')
                    node.operation=operation
                    links.new(angle.outputs[0],node.inputs[0])
                    periodic.append(node.outputs[0])
            for channel,value in zip(('X','Y','Z'),periodic[:3]): links.new(value,combine.inputs[channel])
            noise=nodes.new('ShaderNodeTexNoise')
            noise.noise_dimensions='4D'
            noise.inputs['Scale'].default_value=.85
            noise.inputs['Detail'].default_value=3.2
            noise.inputs['Roughness'].default_value=.63
            links.new(combine.outputs[0],noise.inputs['Vector'])
            links.new(periodic[3],noise.inputs['W'])
            ramp=nodes.new('ShaderNodeValToRGB')
            ramp.color_ramp.interpolation='EASE'
            a,b=ramp.color_ramp.elements
            wear=1.06 if name in ('floor','wall') else 1.19
            a.position=.35; a.color=(*(v*.96 for v in base),1)
            b.position=.70; b.color=(*(min(1,v*wear) for v in base),1)
            c=ramp.color_ramp.elements.new(.555); c.color=(*base,1)
            d=ramp.color_ramp.elements.new(.575); d.color=(*(min(1,v*wear) for v in base),1)
            links.new(noise.outputs['Fac'],ramp.inputs[0])
            links.new(ramp.outputs[0],emission.inputs['Color'])
            links.new(emission.outputs[0],output.inputs['Surface'])
            image=bpy.data.images.new('Respite-'+name+'-paint',width=1024,height=1024,alpha=False)
            image.filepath_raw=str(folder/(name+'-paint.png'))
            image.file_format='PNG'
            target=nodes.new('ShaderNodeTexImage')
            target.image=image
            nodes.active=target
            plane.data.materials.clear()
            plane.data.materials.append(mat)
            bpy.context.view_layer.objects.active=plane
            plane.select_set(True)
            bpy.ops.object.bake(type='EMIT',margin=0,use_clear=True)
            image.save()
            bpy.data.materials.remove(mat)
            print('Baked '+name)
    finally:
        bpy.data.objects.remove(plane,do_unlink=True)
        scene.cycles.samples=previous_samples
        scene.cycles.device=previous_device
    apply_textures()


def apply_textures(keys=None):
    for name in PALETTE:
        path=ROOT/'textures'/(name+'-paint.png')
        mat=bpy.data.materials.get('Respite.'+name)
        if not path.exists() or not mat: continue
        image=bpy.data.images.load(str(path),check_existing=True)
        image.reload()
        image.pack()
        node=mat.node_tree.nodes.get('Scuffed paint') or mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.name='Scuffed paint'
        node.image=image
        node.extension='REPEAT'
        mat.node_tree.links.new(node.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    for collection in bpy.data.collections:
        if not collection.name.startswith('Respite.'): continue
        if keys and collection.name.split('.',1)[1] not in keys: continue
        for obj in collection.objects:
            if obj.type!='MESH' or not obj.get('respite_generated'): continue
            mesh=obj.data
            uv=mesh.uv_layers.active or mesh.uv_layers.new(name='UVMap')
            for face in mesh.polygons:
                axis=max(range(3),key=lambda a:abs(face.normal[a]))
                axes=((1,2),(0,2),(0,1))[axis]
                for loop_index in face.loop_indices:
                    point=obj.matrix_local @ mesh.vertices[mesh.loops[loop_index].vertex_index].co
                    uv.data[loop_index].uv=(point[axes[0]]/8,point[axes[1]]/8)
    print('Applied packed image textures and metre-scaled UVs.')


if __name__=='__main__': bake_materials()
