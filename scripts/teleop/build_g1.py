"""Build the G1 teleop workcell: decimate Menagerie meshes, mount the pelvis on a
test stand, add hand sites, cameras, a table with target pads, and save one .mjb.

Usage: python3 build_g1.py <menagerie/unitree_g1> <out_dir>
"""
import math, os, re, shutil, sys
import mujoco, numpy as np, trimesh, fast_simplification

src, out = sys.argv[1], sys.argv[2]
os.makedirs(f"{out}/assets", exist_ok=True)

xml = open(f"{src}/g1.xml").read()
meshes = re.findall(r'file="([^"]+\.STL)"', xml)

# 1. Decimate. Visual fidelity at video-panel size needs ~10-15% of the faces.
tot_in = tot_out = 0
for f in meshes:
    m = trimesh.load(f"{src}/assets/{f}", force="mesh")
    n = len(m.faces)
    target = max(600, int(n * 0.12))
    if target < n:
        v, fc = fast_simplification.simplify(m.vertices, m.faces, target_reduction=1 - target / n)
        m = trimesh.Trimesh(v, fc, process=True)
    m.export(f"{out}/assets/{f}")
    tot_in += n; tot_out += len(m.faces)
print(f"faces {tot_in} -> {tot_out}")

# 2. Edit the robot description.
xml = xml.replace('<freejoint name="floating_base_joint"/>', "")  # pelvis bolted to the stand
xml = xml.replace('<body name="pelvis" pos="0 0 0.793"', '<body name="pelvis" pos="0 0 0.80"')
# Robot geoms collide with the world, not with each other (contype 1, conaffinity 0).
xml = xml.replace('<geom group="3" type="mesh"/>', '<geom group="3" type="mesh" contype="1" conaffinity="0"/>')
# Hand sites: the palm-centre the operator steers.
xml = xml.replace(
    '<geom pos="0.0415 0.003 0" quat="1 0 0 0" class="visual" mesh="left_rubber_hand"/>',
    '<geom pos="0.0415 0.003 0" quat="1 0 0 0" class="visual" mesh="left_rubber_hand"/>\n'
    '                          <site name="left_hand" pos="0.11 0.004 0" size="0.012" group="4"/>')
xml = xml.replace(
    '<geom pos="0.0415 -0.003 0" quat="1 0 0 0" class="visual" mesh="right_rubber_hand"/>',
    '<geom pos="0.0415 -0.003 0" quat="1 0 0 0" class="visual" mesh="right_rubber_hand"/>\n'
    '                          <site name="right_hand" pos="0.11 -0.004 0" size="0.012" group="4"/>')
# Head camera, fixed to the torso, looking forward and down.
a = math.radians(52)
xml = xml.replace(
    '<site name="imu_in_torso"',
    f'<camera name="head_cam" pos="0.08 0 0.42" xyaxes="0 -1 0 {math.sin(a):.4f} 0 {math.cos(a):.4f}" fovy="78"/>\n'
    '            <site name="imu_in_torso"')
xml = xml.replace('<keyframe>', '<!--').replace('</keyframe>', '-->')  # keyframe has the old nq
open(f"{out}/g1.xml", "w").write(xml)

# 3. The workcell around it.
pads = [  # name, x, y, rgba
    ("pad_l1", 0.30, 0.20, "0.80 0.42 0.30 1"), ("pad_l2", 0.38, 0.10, "0.60 0.62 0.72 1"),
    ("pad_c",  0.34, 0.00, "0.30 0.30 0.26 1"),
    ("pad_r1", 0.30, -0.20, "0.32 0.42 0.30 1"), ("pad_r2", 0.38, -0.10, "0.70 0.66 0.40 1"),
]
TABLE_Z = 0.80
pad_xml = "\n".join(
    f'    <geom name="{n}" type="cylinder" size="0.035 0.004" pos="{x} {y} {TABLE_Z + 0.004}" rgba="{c}" contype="0" conaffinity="0"/>\n'
    f'    <site name="{n}" pos="{x} {y} {TABLE_Z + 0.03}" size="0.01" group="5"/>' for n, x, y, c in pads)
scene = f'''<mujoco model="g1_teleop_workcell">
  <include file="g1.xml"/>
  <option timestep="0.002"/>
  <statistic center="0.3 0 0.9" extent="1.4"/>
  <worldbody>
    <light pos="0.6 -0.4 2.6" dir="-0.2 0.15 -1" diffuse="0.8 0.8 0.78"/>
    <geom name="floor" type="plane" size="4 4 0.05" rgba="0.17 0.17 0.14 1" contype="0" conaffinity="1"/>
    <geom name="stand_post" type="box" size="0.035 0.035 0.40" pos="-0.17 0 0.40" rgba="0.32 0.32 0.25 1" contype="0" conaffinity="0"/>
    <geom name="stand_arm" type="box" size="0.09 0.03 0.03" pos="-0.10 0 0.78" rgba="0.32 0.32 0.25 1" contype="0" conaffinity="0"/>
    <geom name="stand_base" type="box" size="0.22 0.22 0.012" pos="-0.17 0 0.012" rgba="0.32 0.32 0.25 1" contype="0" conaffinity="0"/>
    <geom name="table" type="box" size="0.17 0.36 0.02" pos="0.40 0 {TABLE_Z - 0.02}" rgba="0.82 0.75 0.69 1" contype="0" conaffinity="1"/>
    <geom name="table_leg" type="box" size="0.03 0.3 {(TABLE_Z - 0.04) / 2:.3f}" pos="0.50 0 {(TABLE_Z - 0.04) / 2:.3f}" rgba="0.32 0.32 0.25 1" contype="0" conaffinity="0"/>
{pad_xml}
    <camera name="workcell_cam" pos="1.25 -0.85 1.55" xyaxes="0.56 0.83 0 -0.43 0.29 0.86" fovy="45"/>
  </worldbody>
</mujoco>
'''
open(f"{out}/scene.xml", "w").write(scene)

model = mujoco.MjModel.from_xml_path(f"{out}/scene.xml")
mujoco.mj_saveModel(model, f"{out}/g1_workcell.mjb", None)
print("nq", model.nq, "nu", model.nu, "nbody", model.nbody, "ngeom", model.ngeom,
      "mjb bytes", os.path.getsize(f"{out}/g1_workcell.mjb"))
