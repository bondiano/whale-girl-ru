#!/usr/bin/env python3
"""Self-tests for slice-sheet.py, including proof that invalid input is rejected.

Run: python3 tests/slice-sheet.test.py
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

SCRIPT = Path(__file__).resolve().parent.parent / 'scripts' / 'slice-sheet.py'


def make_img(size, color=(200, 100, 50, 255)):
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    img.paste(color, (0, 0, size[0], size[1]))
    return img


def run(*args, **kw):
    return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True, **kw)


def check(name, cond, detail=''):
    status = 'ok' if cond else 'FAIL'
    print(f'{status} - {name}{"  " + detail if detail and not cond else ""}')
    return cond


def test_normalize_content():
    import importlib.util
    spec = importlib.util.spec_from_file_location('slice_sheet', SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    # Full-frame content becomes bottom-aligned at the requested scale after normalization.
    img = make_img((256, 256), (200, 100, 50, 255))
    norm = mod.normalize_content(img, 256, scale=0.88, align='bottom')
    assert norm.size == (256, 256)
    ratio = mod.content_ratio(norm)
    assert abs(ratio - 0.88) < 0.02, f'内容占比 {ratio} ≠ 0.88'
    # Bottom alignment: the content bounding box ends near the bottom of the frame.
    bbox = norm.getchannel('A').getbbox()
    assert bbox[3] >= 250, f'底对齐失败 bbox={bbox}'
    # A fully transparent image returns None.
    assert mod.normalize_content(Image.new('RGBA', (10, 10), (0, 0, 0, 0)), 256) is None
    print('ok - normalize_content（占比/底对齐/空图）')
    return True


def test_reorder_frames():
    import importlib.util
    spec = importlib.util.spec_from_file_location('slice_sheet', SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    # Three frames with a different color in each.
    sheet = Image.new('RGBA', (768, 256), (0, 0, 0, 0))
    for i in range(3):
        f = Image.new('RGBA', (256, 256), (i * 80, 50, 50, 255))
        sheet.paste(f, (i * 256, 0))
    # Reorder 2,0,1: output frame zero must be the original frame two, colored (160,50,50).
    out = mod.reorder_frames(sheet, 3, '2,0,1')
    assert out.size == (768, 256)
    assert out.getpixel((128, 128))[:3] == (160, 50, 50)
    # Reject invalid orders.
    try:
        mod.reorder_frames(sheet, 3, '0,2')  # Wrong length.
        assert False, '长度不符未拒绝'
    except ValueError:
        pass
    try:
        mod.reorder_frames(sheet, 3, '0,1,1')  # Duplicate index.
        assert False, '重复索引未拒绝'
    except ValueError:
        pass
    print('ok - reorder_frames（重排/非法拒绝）')
    return True


def test_cli_requires_mode():
    # A mode must be supplied.
    with tempfile.TemporaryDirectory() as td:
        img = make_img((64, 64))
        p = Path(td) / 'in.png'
        img.save(p)
        r = run(str(p))
        assert r.returncode != 0, '无模式时未失败'
        assert '--single' in r.stderr or '--grid' in r.stderr or '--sheet' in r.stderr
    print('ok - CLI 要求模式（拒绝无模式调用）')
    return True


def test_cli_single_columns():
    # Single mode with columns: separate outputs and normalized content ratio.
    import importlib.util
    spec = importlib.util.spec_from_file_location('slice_sheet', SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    with tempfile.TemporaryDirectory() as td:
        # Different colors in the left and right halves.
        img = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
        left = make_img((64, 128), (200, 50, 50, 255))
        right = make_img((64, 128), (50, 200, 50, 255))
        img.paste(left, (0, 0))
        img.paste(right, (64, 0))
        p = Path(td) / 'pair.png'
        img.save(p)
        r = run(str(p), '--single', '--columns', '2', '--states', 'a,b', '--size', '64', '--out', td)
        assert r.returncode == 0, f'失败: {r.stderr}'
        assert (Path(td) / 'a.png').exists()
        assert (Path(td) / 'b.png').exists()
        a = Image.open(Path(td) / 'a.png')
        assert a.getpixel((32, 32))[:3] == (200, 50, 50), '左栏内容错'
        b = Image.open(Path(td) / 'b.png')
        assert b.getpixel((32, 32))[:3] == (50, 200, 50), '右栏内容错'
    print('ok - CLI single+columns（分栏/命名/内容）')
    return True


if __name__ == '__main__':
    results = [
        test_normalize_content(),
        test_reorder_frames(),
        test_cli_requires_mode(),
        test_cli_single_columns(),
    ]
    if not all(results):
        sys.exit(1)
    print('全部通过')
