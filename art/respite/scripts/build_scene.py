import bpy
import bmesh
import json
import math
import runpy
import time
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
ASSET_KEYS = ('codex', 'stash', 'workshop', 'bazaar', 'exit', 'habitat', 'ground')
PLACEMENTS = {
    'codex': (-12, 12, 16),
    'stash': (-17, -3, 64),
    'workshop': (23, 14, -28),
    'bazaar': (16, -5, -48),
    'exit': (6, 24, 0),
    'habitat': (0, 0, 0),
    'ground': (0, 0, 0),
}
CURRENT_COLLECTION = None
CURRENT_ROOT = None
MATERIALS = {}


def material(name, rgb, roughness=.78, metallic=.1, emission=0):
    m = bpy.data.materials.get('Respite.' + name)
    if m:
        MATERIALS[name]=m
        return m
    m = bpy.data.materials.new('Respite.' + name)
    m.use_nodes = True
    node = m.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*rgb, 1)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Emission Color'].default_value = (*rgb, 1)
    node.inputs['Emission Strength'].default_value = emission
    m.diffuse_color = (*rgb, 1)
    MATERIALS[name] = m
    return m


def setup_materials():
    material('shell', (.24, .255, .29))
    material('trim', (.32, .335, .365), .7, .2)
    material('dark', (.065, .077, .10), .68, .3)
    material('roof', (.16, .18, .22))
    material('glass', (.025, .048, .075), .22, .42)
    material('fabric', (.17, .095, .19), .95, 0)
    material('floor', (.18, .195, .23), .9, 0)
    material('joint', (.12, .13, .15), .95, 0)
    material('wall', (.13, .15, .19), .9, .08)
    material('cyan', (.06, .7, 1), .4, .05, 4)
    material('lilac', (.6, .23, .9), .4, .05, 3)
    material('warm', (1, .69, .37), .4, .05, 2)
    material('amber', (1, .20, .025), .4, .05, 3)


def select_collection(key):
    global CURRENT_COLLECTION, CURRENT_ROOT
    name = 'Respite.' + key
    existing = bpy.data.collections.get(name)
    previous_root=bpy.data.objects.get(key)
    previous_matrix=previous_root.matrix_world.copy() if previous_root else None
    retained=[]
    if existing:
        retained=[(obj,obj.matrix_world.copy(),obj.parent.name if obj.parent else None) for obj in existing.all_objects if not obj.get('respite_generated')]
        for obj in list(existing.all_objects):
            if obj.get('respite_generated'):
                bpy.data.objects.remove(obj, do_unlink=True)
        CURRENT_COLLECTION = existing
    else:
        CURRENT_COLLECTION = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(CURRENT_COLLECTION)
    CURRENT_ROOT = bpy.data.objects.new(key, None)
    CURRENT_ROOT['respite_generated'] = True
    CURRENT_ROOT['asset_id'] = key
    CURRENT_COLLECTION.objects.link(CURRENT_ROOT)
    x, y, degrees = PLACEMENTS.get(key, (0, 0, 0))
    CURRENT_ROOT.location = (x, y, 0)
    CURRENT_ROOT.rotation_euler.z = math.radians(degrees)
    if previous_matrix is not None:
        CURRENT_ROOT.matrix_world=previous_matrix
    for obj,matrix,parent_name in retained:
        obj.parent=bpy.data.objects.get(parent_name) if parent_name else None
        if parent_name and obj.parent is None: obj.parent=CURRENT_ROOT
        obj.matrix_world=matrix
    CURRENT_ROOT.empty_display_size = 1
    return CURRENT_ROOT


def finish(obj, name, mat='shell', bevel=0):
    obj.name = CURRENT_ROOT.name + '.' + name
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    CURRENT_COLLECTION.objects.link(obj)
    obj.parent = CURRENT_ROOT
    obj['respite_generated'] = True
    if mat:
        obj.data.materials.append(MATERIALS[mat])
    if bevel:
        mod = obj.modifiers.new('Soft edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.affect = 'EDGES'
        mod = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    return obj


def recalculate_mesh(mesh):
    bm=bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()


def box(name, center, size, mat='shell', bevel=.07):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel)


def cylinder(name, center, radius, depth, mat='dark', axis='Z', vertices=32, bevel=.04):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center)
    obj = bpy.context.object
    if axis == 'Y':
        obj.rotation_euler.x = math.pi / 2
    elif axis == 'X':
        obj.rotation_euler.y = math.pi / 2
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel)


def pipe(name, coordinates, radius=.2, mat='dark'):
    points=[Vector(p) for p in coordinates]
    rounded=[points[0]]
    for i in range(1,len(points)-1):
        p=points[i]
        a=points[i-1]-p
        b=points[i+1]-p
        reach=min(radius*2.8,a.length*.4,b.length*.4)
        start=p+a.normalized()*reach
        end=p+b.normalized()*reach
        for j in range(9):
            t=j/8
            rounded.append((1-t)**2*start+2*(1-t)*t*p+t*t*end)
    rounded.append(points[-1])
    data=bpy.data.curves.new(name,'CURVE')
    data.dimensions='3D'
    data.bevel_depth=radius
    data.bevel_resolution=2
    data.use_fill_caps=True
    spline=data.splines.new('POLY')
    spline.points.add(len(rounded)-1)
    for point,coord in zip(spline.points,rounded): point.co=(*coord,1)
    obj=bpy.data.objects.new(name,data)
    CURRENT_COLLECTION.objects.link(obj)
    obj=finish(obj,name,mat)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def prism(name, polygon, y_front, depth, mat='shell', bevel=.05):
    n = len(polygon)
    verts = [(x, y, z) for y in (y_front, y_front + depth) for x, z in polygon]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    recalculate_mesh(mesh)
    obj = bpy.data.objects.new(name, mesh)
    CURRENT_COLLECTION.objects.link(obj)
    return finish(obj, name, mat, bevel)


def arc(name, center, inner, outer, front, depth, start=-50, end=230, segments=48, mat='trim'):
    cx, cz = center
    verts = []
    for y in (front, front + depth):
        for r in (inner, outer):
            verts += [(cx + r * math.cos(math.radians(start + (end-start)*i/segments)), y,
                       cz + r * math.sin(math.radians(start + (end-start)*i/segments)))
                      for i in range(segments + 1)]
    n = segments + 1
    faces = []
    for i in range(segments):
        faces.extend([(i, i+1, n+i+1, n+i),
                      (2*n+i, 3*n+i, 3*n+i+1, 2*n+i+1),
                      (i, 2*n+i, 2*n+i+1, i+1),
                      (n+i, n+i+1, 3*n+i+1, 3*n+i)])
    faces.extend([(0, n, 3*n, 2*n), (n-1, 3*n-1, 4*n-1, 2*n-1)])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    recalculate_mesh(mesh)
    obj = bpy.data.objects.new(name, mesh)
    CURRENT_COLLECTION.objects.link(obj)
    return finish(obj, name, mat, .025)


def door(name, x, y, bottom=.15, width=1.5, height=2.4):
    box(name + '.recess', (x, y, bottom + height/2), (width+.32, .25, height+.3), 'dark', .04)
    box(name + '.leaf', (x, y-.14, bottom + height/2), (width, .10, height), 'roof', .03)
    box(name + '.split', (x, y-.205, bottom + height/2), (.025, .025, height), 'dark', 0)
    box(name + '.lintel', (x, y-.24, bottom+height+.17), (width+.5, .55, .27), 'trim')
    box(name + '.lamp', (x, y-.525, bottom+height+.13), (width*.65, .035, .10), 'warm', .015)


def build_codex():
    select_collection('codex')
    box('rooms', (0, .3, 3.65), (8.8, 9.9, 7.3), 'shell', .2)
    box('roof', (0, .3, 7.32), (8.7, 9.7, .22), 'roof')
    for side in (-1, 1):
        for y in (-4.65,.7,4.95):
            box('side-pier'+str((side,y)), (side*4.42, y, 3.65), (.38,.48,7.3), 'trim', .10)
        box('side-base'+str(side),(side*4.44,.15,.35),(.30,10.1,.70),'trim',.08)
        box('side-cornice'+str(side),(side*4.44,.15,7.1),(.35,10.1,.55),'trim',.08)
        for y in (-2.0,2.85):
            for z in (2.2,5.0):
                box('side-panel'+str((side,y,z)),(side*4.43,y,z),(.12,4.25,2.53),'shell',.035)
        panel = [(side*x, z) for x,z in [(1.7, 2.9), (3.3, 2.9), (3.55, 8.8), (1.75, 8.35)]]
        if side < 0:
            panel.reverse()
        prism('front-fin'+str(side), panel, -5.3, .48, 'trim', .09)
        box('outer-fin'+str(side), (side*3.94, -5.07, 4.7), (.62, .65, 5.35), 'shell', .08)
        box('foot-pier'+str(side),(side*3.85,-4.98,1.2),(1.1,.92,2.4),'trim',.12)
        box('foot-base'+str(side),(side*3.85,-5.08,.3),(1.25,1.15,.6),'shell',.10)
        box('low-window-frame'+str(side),(side*2.50,-4.72,1.5),(1.28,.17,1.5),'dark',.05)
        box('low-window'+str(side),(side*2.50,-4.82,1.5),(1.05,.03,1.25),'glass',.025)
        box('entry-side-light'+str(side),(side*1.13,-4.88,1.7),(.105,.05,.68),'warm',.018)
    box('upper-window-frame', (0, -4.79, 5.0), (3.12, .22, 2.13), 'dark')
    box('upper-window', (0, -4.925, 5.0), (2.78, .03, 1.83), 'glass', .025)
    door('entry', 0, -4.86, .42, 1.65, 2.35)
    prism('entrance-brow',[(-1.62,2.8),(1.62,2.8),(1.49,3.25),(-1.49,3.25)],-5.35,.55,'trim',.06)
    box('front-base',(0,-4.84,.17),(7.2,.27,.34),'trim',.05)
    for i in range(3):
        box('step'+str(i), (0, -5.95+i*.3, .07*(i+1)), (2.75, 1.4-i*.3, .14*(i+1)), 'trim', .03)
    box('lilac-inset', (-3.49, -5.46, 5.2), (.12, .07, .94), 'lilac', .025)
    box('roof-plant', (1.0, 3.1, 7.8), (3.2, 1.7, .95), 'roof', .12)
    box('plant-grille',(1,2.21,7.86),(1.05,.06,.48),'dark',.02)
    for z in (7.7,7.84,7.98):
        box('plant-louvre'+str(z),(1,2.16,z),(.95,.08,.045),'trim',.012)
    box('rear-parapet',(0,5.16,7.55),(8.75,.35,.40),'trim',.06)
    for s in (-1,1):
        box('side-parapet'+str(s),(s*4.23,.3,7.5),(.27,9.65,.34),'trim',.05)
    box('upper-side-window-frame',(4.53,3.47,5.68),(.08,1.4,.8),'dark',.02)
    box('upper-side-window',(4.58,3.47,5.68),(.025,1.17,.58),'glass',.012)
    pipe('rear-return-pipe',[(4.72,4.65,6.7),(4.94,4.65,6.48),(4.94,4.65,1.1),(4.65,4.65,.8)],.17)
    for z in (1.4,3.6,6.15):
        cylinder('pipe-collar'+str(z),(4.94,4.65,z),.23,.15,'trim',vertices=20)


def build_stash():
    select_collection('stash')
    box('left-wall', (-3.95, 0, 2.6), (1.1, 10, 5.2), 'shell', .15)
    box('right-wall', (3.95, 0, 2.6), (1.1, 10, 5.2), 'shell', .15)
    box('rear-wall', (0, 4.5, 2.6), (7.9, 1, 5.2), 'shell', .15)
    box('roof', (0, 0, 4.85), (8.6, 10, .75), 'roof', .15)
    box('vestibule-turn', (0, -1.5, 2), (7, .4, 4), 'dark')
    box('vestibule-floor', (0, -3.5, .025), (7, 3.2, .08), 'floor', .02)
    for s in (-1,1):
        poly=[(s*x,z) for x,z in [(3.1,0),(4.65,0),(4.65,1.1),(4.25,1.6),(4.25,3.1),(3.6,5.3),(2.9,5.3),(3.1,3.2)]]
        if s<0: poly.reverse()
        prism('jamb'+str(s), poly, -5.4, .65, 'trim', .10)
    box('lintel', (0,-5.07,4.75),(5.95,.8,1.1),'trim',.16)
    box('left-vault-leaf',(-1.55,-4.93,2.0),(3.05,.44,3.8),'shell',.09)
    leaf=box('open-vault-leaf',(0,0,0),(2.9,.48,3.8),'trim',.09)
    # The hinge is the origin, so the leaf stays editable as a rigid door.
    for v in leaf.data.vertices: v.co.x -= 1.45
    leaf.location=(3.03,-5.08,2.0)
    leaf.rotation_euler.z=math.radians(52)
    box('entry-lamp',(0,-5.52,4.05),(2.4,.06,.13),'warm',.025)
    box('control',(-3.8,-5.79,1.9),(.3,.13,.7),'dark')
    box('control-screen',(-3.8,-5.87,2.03),(.13,.025,.23),'cyan',.01)
    for s in (-1,1):
        for y in (-2.9,1.0,4.65):
            box('armor-band'+str((s,y)),(s*4.50,y,2.7),(.27,.5,5.0),'trim',.07)
        for y in (-1.0,2.85):
            for z in (1.5,3.5):
                box('side-plate'+str((s,y,z)),(s*4.51,y,z),(.10,3.2,1.76),'shell',.03)
        box('base-rail'+str(s),(s*4.51,0,.40),(.4,9.7,.70),'roof',.07)
        box('roof-rail'+str(s),(s*4.17,0,5.20),(.22,9.7,.18),'trim',.035)
    box('rear-roof-rail',(0,4.77,5.20),(8.3,.22,.18),'trim',.035)
    inset=box('open-leaf-face',(0,0,0),(2.50,.12,3.35),'shell',.05)
    inset.parent=leaf
    inset.location=(-1.45,-.30,0)
    for z in (-1.1,0,1.1):
        bolt=box('door-lock'+str(z),(0,0,0),(.35,.28,.34),'dark',.045)
        bolt.parent=leaf
        bolt.location=(-2.81,-.34,z)
    for z in (.85,3.22):
        cylinder('hinge'+str(z),(3.10,-5.05,z),.27,.65,'dark',vertices=24)
        cylinder('hinge-band'+str(z),(3.10,-5.05,z),.31,.12,'trim',vertices=24)
    pipe('side-conduit',[(-4.82,3.8,1),(-4.82,3.8,3.9),(-4.82,3.4,4.3),(-4.82,-2.5,4.3)],.17)


def build_workshop():
    select_collection('workshop')
    box('rear-hall', (0, 1.6, 3.05), (10, 10.2, 6.1), 'shell', .18)
    box('rear-roof', (0, 1.6, 6.14), (9.8, 10, .3), 'roof', .09)
    box('service-room', (-2.8, -4, 1.65), (4.5, 3.6, 3.3), 'shell', .15)
    door('service-entry', -3.65, -5.85, .15, 1.2, 2.3)
    box('service-window-frame',(-1.7,-5.84,1.9),(1.5,.16,1.25),'dark')
    box('service-window',(-1.7,-5.935,1.9),(1.26,.025,1.02),'glass',.02)
    cylinder('single-process-drum',(2,-3.8,3.35),2.7,3.7,'shell','X',48,.12)
    for x in (.1,3.9):
        cylinder('drum-band'+str(x),(x,-3.8,3.35),2.82,.3,'trim','X',48,.06)
    box('drum-cradle',(2,-3.8,.62),(4.6,5.8,1.2),'roof',.18)
    box('process-recess',(2,-6.49,3.35),(1.8,.13,.43),'dark')
    box('horizontal-process-slit',(2,-6.58,3.35),(1.5,.035,.16),'amber',.025)
    for i,x in enumerate((-3.4,-1.65)):
        pipe('roof-feed'+str(i),[(x,-3.5,3.35),(x,-3.5,6.7),(x,-2.6,7.0),(x,4.2,7.0),(x,4.2,6.3)],.34)
        cylinder('riser-collar'+str(i),(x,-3.5,4.0),.46,.18,'trim')
    box('roof-exchanger',(-1.8,4.2,6.55),(3.7,1.9,1.0),'roof',.12)
    pipe('process-return',[(-.8,-4.6,3.3),(-.8,-4.6,4.7),(-.25,-4.6,5.25),(.15,-4.6,5.25)],.30)
    for s in (-1,1):
        box('hall-base'+str(s),(s*4.94,1.6,.40),(.35,10.25,.8),'trim',.08)
        for y in (-2.9,1.4,6.2):
            box('hall-pier'+str((s,y)),(s*5,y,3.15),(.4,.52,6.3),'trim',.10)
        for y in (-.7,3.8):
            for z in (2,4.65):
                box('hall-panel'+str((s,y,z)),(s*5.01,y,z),(.10,3.75,2.1),'shell',.025)
        box('hall-parapet'+str(s),(s*4.75,1.6,6.44),(.25,10,.35),'trim',.05)
    for s in (-1,1):
        x=2+s*2.1
        poly=[(x-.35,0),(x+.35,0),(x+.35,1.15),(x+.16,2.9),(x-.18,2.9),(x-.35,1.0)]
        prism('drum-support'+str(s),poly,-6.35,1.0,'trim',.07)
    for x in (-5.0,-.65):
        box('service-corner'+str(x),(x,-5.6,1.7),(.3,.35,3.4),'trim',.08)
    for x in (-3.8,-2.6,-1.4):
        box('exchanger-slat'+str(x),(x,3.19,6.58),(.55,.05,.09),'dark',.01)


def canopy(name, x, y, width, direction=0):
    # Four transverse sections create a supported, shallow fabric sag.
    rows=[(0,3.75),(.55,3.25),(1.25,2.93),(1.65,2.9)]
    verts=[(s*width/2, d, z) for d,z in rows for s in (-1,1)]
    faces=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(rows)-1)]
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    obj=bpy.data.objects.new(name,mesh)
    CURRENT_COLLECTION.objects.link(obj)
    obj=finish(obj,name,'fabric')
    obj.location=(x,y,0)
    obj.rotation_euler.z=direction
    solid=obj.modifiers.new('Fabric thickness','SOLIDIFY')
    solid.thickness=.035
    for s in (-1,1):
        px=x+s*width/2*math.cos(direction)-1.65*math.sin(direction)
        py=y+s*width/2*math.sin(direction)+1.65*math.cos(direction)
        cylinder(name+'.post'+str(s),(px,py,1.45),.045,2.9,'dark',vertices=12,bevel=.01)


def build_bazaar():
    select_collection('bazaar')
    half_width, half_depth, room_depth = 8.5, 7.5, 3.0
    inner = half_width-room_depth
    wing = half_width-room_depth/2
    rear = half_depth-room_depth/2
    gate = 3.2
    vendor_rows = (-3.1, .7)
    for side in (-1, 1):
        box('vendor-wing'+str(side),(side*wing,0,2.15),(room_depth,half_depth*2,4.3),'shell',.13)
        box('wing-roof'+str(side),(side*wing,0,4.36),(room_depth+.2,half_depth*2+.2,.28),'roof')
        return_width=half_width-gate
        return_center=side*(half_width+gate)/2
        box('return-wall'+str(side),(return_center,-half_depth-.1,1.45),(return_width,.45,2.9),'shell',.10)
        box('return-cap'+str(side),(return_center,-half_depth-.1,2.98),(return_width,.57,.2),'trim',.04)
        box('gatepost'+str(side),(side*gate,-half_depth-.15,1.9),(.5,.65,3.8),'trim',.07)
        box('gatepost-foot'+str(side),(side*gate,-half_depth-.15,.3),(.70,.83,.6),'roof',.055)
        box('gate-accent'+str(side),(side*gate,-half_depth-.51,2.4),(.075,.025,.7),'lilac',.015)
        for i,y in enumerate(vendor_rows):
            box('vendor-counter'+str((side,i)),(side*(inner-.32),y,.62),(.8,2.7,1.24),'trim')
            box('vendor-shutter'+str((side,i)),(side*(inner-.03),y,2.2),(.04,2.7,2.15),'dark',.02)
            canopy('awning'+str((side,i)),side*inner,y,3.0,side*math.pi/2)
            box('stall-header'+str((side,i)),(side*(inner-.10),y,3.76),(.25,2.9,.28),'trim',.04)
            box('stall-lamp'+str((side,i)),(side*(inner-.25),y,3.67),(.05,1.8,.09),'warm',.012)
            for z in (1.55,1.9,2.25,2.60,2.95):
                box('shutter-course'+str((side,i,z)),(side*(inner-.065),y,z),(.05,2.57,.045),'roof',.01)
            box('counter-pad'+str((side,i)),(side*(inner-.35),y,1.27),(.47,1.4,.05),'dark',.02)
        for y in (-half_depth+.25,-2.5,2.5,half_depth-.25):
            box('outer-pier'+str((side,y)),(side*(half_width-.07),y,2.25),(.4,.46,4.5),'trim',.075)
        for y in (-4.9,0,4.9):
            for z in (1.25,3.2):
                box('outer-cladding'+str((side,y,z)),(side*(half_width+.01),y,z),(.12,4.35,1.55),'shell',.035)
        for x in (half_width-.18,inner+.1):
            box('wing-parapet'+str((side,x)),(side*x,0,4.60),(.24,half_depth*2-.2,.25),'trim',.04)
        for x in (gate+.95,half_width-.95):
            box('return-panel'+str((side,x)),(side*x,-half_depth-.35,1.65),(1.78,.08,1.8),'shell',.025)
    box('rear-vendor-wing',(0,rear,2.15),(inner*2,room_depth,4.3),'shell',.13)
    box('rear-roof',(0,rear,4.36),(inner*2,room_depth+.2,.28),'roof')
    for x in (-2.75,2.75):
        y=half_depth-room_depth
        box('rear-counter'+str(x),(x,y-.3,.62),(3.8,.8,1.24),'trim')
        box('rear-shutter'+str(x),(x,y-.04,2.2),(3.8,.04,2.15),'dark',.02)
        canopy('rear-awning'+str(x),x,y,4.5,math.pi)
        box('rear-stall-header'+str(x),(x,y-.12,3.77),(4.1,.28,.27),'trim',.045)
        box('rear-stall-lamp'+str(x),(x,y-.29,3.65),(2.6,.04,.09),'warm',.012)
        for z in (1.55,1.9,2.25,2.60,2.95):
            box('rear-shutter-course'+str((x,z)),(x,y-.08,z),(3.65,.05,.045),'roof',.01)
    box('banner-crossbar',(0,-half_depth-.15,3.45),(gate*2+.45,.11,.12),'dark',.03)
    box('banner',(0,-half_depth-.17,3.02),(gate*2-.55,.04,.7),'fabric',.02)
    box('court-floor',(0,0,.02),(half_width*2,half_depth*2+.2,.08),'floor',.01)
    box('rear-service-plant',(1.5,rear,4.95),(3.4,2,1.0),'roof',.10)
    pipe('outside-service-return',[(half_width+.3,rear,.5),(half_width+.3,rear,3.5),(half_width+.2,rear-.5,4.1),(wing+.2,rear-.5,4.1)],.18)


def build_exit():
    select_collection('exit')
    arc('arch', (0,5.45),6.95,8.05,-1.2,1.4,-51.5,231.5,64)
    arc('cyan-rim',(0,5.45),6.73,6.80,-1.38,.09,-54.8,234.8,64,'cyan')
    box('observation-tower',(9.05,.5,6.9),(3.7,4.1,13.8),'shell',.2)
    for z in (9.4,12.0):
        box('tower-window-frame'+str(z),(9.05,-1.62,z),(3.0,.16,1.9),'dark')
        box('tower-window'+str(z),(9.05,-1.72,z),(2.66,.04,1.6),'glass',.03)
        box('tower-brow'+str(z),(9.05,-1.8,z+1.05),(3.8,.6,.4),'trim')
    door('tower-entry',9.05,-1.63,.1,1.3,2.35)
    box('left-buttress',(-8.1,-.4,6.9),(2.1,3.0,13.8),'shell',.18)
    for index in range(12):
        a=-51.5+index*283/12
        arc('arch-facing'+str(index),(0,5.45),7.05,7.96,-1.25,.15,a+.65,a+283/12-.65,5,'shell')
    for index,a in enumerate((-32,22,77,132,187,222)):
        arc('arch-key'+str(index),(0,5.45),6.96,8.15,-1.44,.45,a-2.6,a+2.6,2,'trim')
    for s in (-1,1):
        x=s*5.65
        prism('arch-foot'+str(s),[(x-.7,0),(x+.7,0),(x+.55,1.3),(x+.3,2.3),(x-.4,2.3),(x-.7,1.1)],-1.6,1.8,'shell',.09)
    for z in (3.5,6.8):
        box('tower-front-panel'+str(z),(9.05,-1.61,z),(2.9,.12,1.6),'shell',.055)
    for x in (7.22,10.88):
        box('tower-upright'+str(x),(x,-1.48,6.8),(.28,.48,13.6),'trim',.08)
    box('tower-cap',(9.05,.25,13.95),(4.2,4.5,.38),'trim',.10)
    pipe('gate-inherited-pipe',[(-7.8,.2,1),(-7.8,.2,10.8),(-6.9,.2,11.7),(-4.8,.2,11.7)],.37)
    for z in (2.2,5.5,8.6):
        cylinder('gate-pipe-joint'+str(z),(-7.8,.2,z),.48,.24,'dark',vertices=24)
    cylinder('tower-aerial',(9.9,.8,15.2),.06,2.8,'dark',vertices=12,bevel=.015)


def build_passage():
    global CURRENT_ROOT
    habitat_root=CURRENT_ROOT
    frame=bpy.data.objects.new('habitat.passage',None)
    CURRENT_COLLECTION.objects.link(frame)
    frame.parent=habitat_root
    frame.location=(6,24,0)
    frame['respite_generated']=True
    CURRENT_ROOT=frame
    arc('inner-liner',(0,5.45),6.76,6.95,-1.32,20,-54.8,234.8,64,'dark')
    for i in range(6):
        arc('rib'+str(i),(0,5.45),6.67,6.78,1.3+i*2.7,.2,-51.5,231.5,48,'roof')
    box('floor',(0,8.8,-.10),(10.2,20.6,.2),'floor',.02)
    box('turn-baffle',(2.5,17,5.8),(8,1.0,12),'dark',.08)
    for i,y in enumerate((1.0,3.7,6.4,10.2,14.0)):
        for s in (-1,1):
            lamp=box('lamp'+str((i,s)),(s*4.7,y,9.97),(1.0,.5,.10),'cyan',.035)
            lamp.rotation_euler.y=s*math.radians(45)
    CURRENT_ROOT=habitat_root


def build_habitat():
    select_collection('habitat')
    wall=box('continuous-wall',(32.5,28,31),(75,8,62),'wall',0)
    cutter=cylinder('temporary-cut',(6,28,5.45),6.96,30,None,'Y',64,0)
    bpy.context.view_layer.objects.active=wall
    mod=wall.modifiers.new('True passage opening','BOOLEAN')
    mod.operation='DIFFERENCE'
    mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter,do_unlink=True)
    wall.data.materials.clear()
    wall.data.materials.append(MATERIALS['wall'])
    for face in wall.data.polygons: face.material_index=0
    bevel=wall.modifiers.new('Wall edges','BEVEL'); bevel.width=.12; bevel.segments=2
    box('left-habitat-base',(-30,28,5.1),(50,8,10.2),'wall',.12)
    for x in (-4,21,37,54,69):
        box('wall-pier'+str(x),(x,22.8,25),(2.3,3.0,50),'wall',.18)
    for z in (18,34,49):
        box('wall-course'+str(z),(32.5,23.7,z),(75,.6,.8),'roof')
    for x in (3.6,12.1,27,45,62):
        for z in (23,29,40,46,56):
            box('large-wall-panel'+str((x,z)),(x,23.91,z),(7.5,.18,4.6),'wall',.05)
    for i,(x,y,w,d,h) in enumerate([(-40,30,8,10,47),(-30,48,9,12,64),(-58,43,12,10,75),(-45,62,14,14,90),(-16,62,10,10,77)]):
        box('distant-mass'+str(i),(x,y,h/2),(w,d,h),'wall',.25)
    box('left-catwalk',(-34,15,17),(60,2.0,.8),'roof')
    box('catwalk-return',(-4,18.5,17),(2.0,7.0,.8),'roof')
    box('upper-left-catwalk',(-34,33,32),(58,2.3,1),'roof')
    box('catwalk-service-recess',(-4,21.22,18.55),(1.5,.1,2.25),'dark',.04)
    box('catwalk-service-door',(-4,21.14,18.55),(1.24,.06,2.04),'roof',.03)
    for x in (-49,-34,-19):
        box('left-support'+str(x),(x,17.2,8.5),(1.1,1.5,17),'wall',.12)
        brace=box('left-bracket'+str(x),(x,16.1,15.1),(.65,3.3,.65),'roof',.06)
        brace.rotation_euler.x=math.radians(35)
    for z,y,width in ((17.6,14.25,60),(32.6,32.05,58)):
        for dz in (.15,.75):
            box('rail'+str((z,dz)),(-34,y,z+dz),(width,.065,.065),'dark',.015)
        for index in range(int(width/2)):
            cylinder('rail-post'+str((z,index)),(-34-width/2+index*2,y,z+.38),.035,.9,'dark',vertices=8,bevel=0)
    for x in (-4.85,-3.15):
        for z in (17.75,18.35):
            box('return-rail'+str((x,z)),(x,18.4,z),(.065,5.2,.065),'dark',.015)
    for index,(x,y,z) in enumerate(((-40,24.8,30),(-29,41.8,45),(-58,37.8,55),(-45,54.8,63),(-16,56.8,55))):
        box('far-signal'+str(index),(x,y,z),(.15,.07,4.5),'lilac',.02)
    pipe('wall-main-feed',[(40,21.5,0),(40,21.5,14),(36,21.5,18),(22,21.5,18)],.70)
    build_passage()


def build_ground():
    select_collection('ground')
    box('continuous-paving',(0,0,-.25),(180,180,.4),'floor',0)
    # Staggered joints keep the paving legible without an editor-like grid.
    for row in range(-14,15):
        y=row*2.4
        box('paving-bed'+str(row),(0,y,-.031),(76,.018,.008),'joint',0)
        offset=2.4 if row%2 else 0
        for column in range(-8,9):
            box('paving-joint'+str((row,column)),(column*4.8+offset,y+1.2,-.031),(.018,2.4,.008),'joint',0)
    for index in range(48):
        a=index*math.tau/48
        b=(index+1)*math.tau/48
        pts=[(r*math.cos(t),r*math.sin(t),-.032) for r in (7.0,7.18) for t in (a,b)]
        mesh=bpy.data.meshes.new('paving-inlay')
        mesh.from_pydata(pts,[],[(0,2,3,1)])
        mesh.update()
        obj=bpy.data.objects.new('paving-inlay',mesh)
        CURRENT_COLLECTION.objects.link(obj)
        finish(obj,'court-inlay'+str(index),'roof')


def camera(name, position, target, lens=42, orthographic=None):
    data=bpy.data.cameras.new(name)
    obj=bpy.data.objects.new(name,data)
    CURRENT_COLLECTION.objects.link(obj)
    obj['respite_generated']=True
    obj.location=position
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    obj['respite_orbit_distance']=(Vector(target)-obj.location).length
    data.lens=lens
    data.clip_end=600
    if orthographic:
        data.type='ORTHO'
        data.ortho_scale=orthographic
    return obj


def area(name, position, target, energy, color=(1,1,1), size=20):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.color=color
    data.shape='DISK'
    data.size=size
    obj=bpy.data.objects.new(name,data)
    CURRENT_COLLECTION.objects.link(obj)
    obj['respite_generated']=True
    obj.location=position
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj


def setup_scene():
    select_collection('presentation')
    scene=bpy.context.scene
    scene.name='Respite'
    scene.unit_settings.system='METRIC'
    scene.unit_settings.scale_length=1.0
    scene.unit_settings.length_unit='METERS'
    scene.camera=camera('Court',(24,-64,40),(0,6,5.0),43)
    camera('Court-alternate',(-33,-46,29),(0,5,4.7),40)
    camera('Plan',(0,8,100),(0,8,0),orthographic=86)
    area('Inspection-key',(-25,-25,48),(0,4,0),16000,(.84,.9,1),30)
    area('Inspection-fill',(34,-2,26),(0,5,0),8500,(.7,.8,1),25)
    area('Inspection-rim',(-12,24,32),(0,0,0),11000,(.65,.72,1),20)
    scene.world=bpy.data.worlds.get('Respite-world') or bpy.data.worlds.new('Respite-world')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.21,.29,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    scene.render.engine='CYCLES'
    scene.cycles.samples=32
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1600
    scene.render.resolution_y=1000
    scene.render.resolution_percentage=75
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='AgX'
    scene.render.film_transparent=False
    prefs=bpy.context.preferences.addons.get('cycles')
    if prefs:
        prefs.preferences.compute_device_type='HIP'
        prefs.preferences.refresh_devices()
        found=False
        for device in prefs.preferences.devices:
            device.use='9070' in device.name
            found=found or device.use
        scene.cycles.device='GPU' if found else 'CPU'
    for screen in bpy.data.screens:
        for area_obj in screen.areas:
            if area_obj.type=='VIEW_3D':
                area_obj.spaces.active.region_3d.view_perspective='CAMERA'


BUILDERS={
    'codex':build_codex,'stash':build_stash,'workshop':build_workshop,
    'bazaar':build_bazaar,'exit':build_exit,'habitat':build_habitat,'ground':build_ground,
}


def build(keys=None):
    if bpy.data.filepath and bpy.data.objects.get('codex'):
        bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'checkpoints'/('before-build-'+str(time.time_ns())+'.blend')),copy=True)
    setup_materials()
    for key in keys or ASSET_KEYS:
        BUILDERS[key]()
    if not bpy.data.objects.get('Court'):
        setup_scene()
    bpy.context.view_layer.update()
    if (ROOT/'textures/shell-paint.png').exists():
        textures=runpy.run_path(str(ROOT/'scripts/bake_materials.py'))
        textures['apply_textures'](keys or ASSET_KEYS)
    ROOT.joinpath('scenes').mkdir(exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'scenes/respite.blend'))
    print(json.dumps({'built':list(keys or ASSET_KEYS),'objects':len(bpy.context.scene.objects)}))


if __name__=='__main__':
    # Fresh construction removes only the untouched Blender startup objects.
    for name in ('Cube','Camera','Light'):
        obj=bpy.data.objects.get(name)
        if obj and not obj.get('respite_generated'):
            obj.hide_render=True
            obj.hide_set(True)
    build()
