#!/usr/bin/env python3
"""Convert AI-generated images into standardized whale-girl PNG assets using PIL and numpy.

Process sticker collections, grids, single images, or columns into consistent frames:
standard size, bottom alignment, target content ratio, corrected frame order, and solid-color removal.

Modes (choose one):
  --single  One image or columns (--columns 2 produces one state per column); key and normalize each.
  --grid    Split a declared grid (--grid RxC), or detect it with --auto.
  --sheet   Rows are states and columns are frames; connected components produce one sheet per state.

Common options:
  --key        Background key: gray for bright-gray masks; auto for border color; R,G,B (multiple colors separated by |).
  --size       Output frame edge length, default 256.
  --normalize-scale  Target content height ratio, default 0.88, leaving transparent margins.
  --align      Bottom alignment (bottom, default), or center.
  --swap-frames Correct frame order with comma-separated target indices, such as 0,2,1.
  --out        Output directory.

Examples:
  # One state and one frame (think image).
  python3 scripts/slice-sheet.py think.png --single --key 252,2,249 --out assets/characters/whale-girl/
  # Two columns: think on the left and wait on the right.
  python3 scripts/slice-sheet.py pair.png --single --columns 2 --states think,wait --key 252,2,249 --out .../
  # A 3x3 grid with one subimage per cell.
  python3 scripts/slice-sheet.py grid.png --grid 3x3 --key auto --out .../
  # Sheet mode: rows are states and columns are frames.
  python3 scripts/slice-sheet.py grid.png --sheet 3x3 --states idle,working --frames 3,3 --key auto --out .../
  # Correct walk frames generated in the order 2,0,1.
  python3 scripts/slice-sheet.py walk.png --single --swap-frames 2,0,1 --out .../
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ALPHA_THRESHOLD = 16
DEFAULT_SCALE = 0.88  # Character height as a fraction of frame height, matching all 15 states and leaving transparent margins.


# ---------- Background removal (retained from the original implementation) ----------

def detect_bg(img):
    """Estimate the background color from the median of the border-ring pixels."""
    arr = np.asarray(img.convert('RGB'), dtype=np.int16)
    border = np.concatenate([arr[0], arr[-1], arr[:, 0], arr[:, -1]])
    return np.median(border, axis=0).astype(int).tolist()


def gray_key(img):
    """Key bright-gray fake transparency checkerboards; saturated or dark pixels are content, bright gray pixels become transparent."""
    from PIL import ImageFilter
    arr = np.asarray(img.convert('RGB'), dtype=np.int16)
    sat = arr.max(axis=2) - arr.min(axis=2)
    lum = arr.mean(axis=2)
    a_sat = np.clip((sat - 25) / 35 * 255, 0, 255)
    a_lum = np.clip((lum - 215) / -40 * 255, 0, 255)
    alpha = np.maximum(a_sat, a_lum).astype(np.uint8)
    out = img.convert('RGBA')
    out.putalpha(Image.fromarray(alpha, 'L').filter(ImageFilter.MedianFilter(3)))
    return out


def bg_floodfill(img, bg_colors, tol):
    """Remove near-background regions that are four-connected to the border; enclosed matching colors inside the character remain."""
    import numpy as np
    from PIL import Image as _Image
    arr = np.asarray(img.convert('RGB'), dtype=np.int16)
    dists = [np.linalg.norm(arr - np.asarray(b, dtype=np.int16), axis=2) for b in bg_colors]
    dmin = np.min(np.stack(dists), axis=0)
    bg_mask = dmin < tol
    h, w = bg_mask.shape
    visited = np.zeros_like(bg_mask)
    stack = []
    for x in range(w):
        for y in (0, h - 1):
            if bg_mask[y, x] and not visited[y, x]:
                visited[y, x] = True
                stack.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if bg_mask[y, x] and not visited[y, x]:
                visited[y, x] = True
                stack.append((y, x))
    while stack:
        y, x = stack.pop()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and bg_mask[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                stack.append((ny, nx))
    alpha = np.where(visited, 0, 255).astype(np.uint8)
    out = img.convert('RGBA')
    out.putalpha(_Image.fromarray(alpha, 'L'))
    return out


def closed_islands_cleanup(img, bg_colors):
    """Clean enclosed islands and tiny extreme-magenta spots; the character palette excludes magenta."""
    from PIL import Image as _Image
    arr = np.asarray(img.convert('RGB'), dtype=np.int16)
    a = np.asarray(img.convert('RGBA').getchannel('A'), dtype=np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    sp = np.minimum(r, b) - g
    dists = [np.linalg.norm(arr - np.asarray(bg, dtype=np.int16), axis=2) for bg in bg_colors]
    dmin = np.min(np.stack(dists), axis=0)
    kill = ((sp > 120) & (dmin < 45)) | ((sp > 120) & (r > 170) & (b > 170) & (g < 130))
    kill &= a > 0
    new_a = np.where(kill, 0, a).astype(np.uint8)
    out = img.convert('RGBA')
    out.putalpha(_Image.fromarray(new_a, 'L'))
    return out


def magenta_free_cleanup(img, sp_thresh=25):
    """Remove all magenta; the character is deep blue and white, so pixels with sp > 25 are outside its palette."""
    from PIL import Image as _Image
    arr = np.asarray(img.convert('RGBA'), dtype=np.int16)
    a = arr[:, :, 3]
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    sp = np.minimum(r, b) - g
    kill = (sp > sp_thresh) & (a > 0)
    new_a = np.where(kill, 0, a).astype(np.uint8)
    out = img.convert('RGBA')
    out.putalpha(_Image.fromarray(new_a, 'L'))
    return out


def defringe(img, erode=1):
    """Erode edges and feather them, removing the outer background-blended layer and smoothing jagged edges."""
    from PIL import ImageFilter
    a = img.getchannel('A')
    for _ in range(erode):
        a = a.filter(ImageFilter.MinFilter(3))
    a = a.filter(ImageFilter.GaussianBlur(1.5))
    out = img.copy()
    out.putalpha(a)
    return out


def apply_key(img, key, repair):
    """Remove the background according to --key and return the processed RGBA image."""
    if not key:
        return img.convert('RGBA')
    if key == 'gray':
        img = gray_key(img)
        print('keyed: gray-mask', file=sys.stderr)
    else:
        bgs = [detect_bg(img)] if key == 'auto' else [[int(v) for v in c.split(',')] for c in key.split('|')]
        bgs = list({tuple(b) for b in bgs} | {tuple(detect_bg(img))})
        img = bg_floodfill(img, bgs, tol=45)
        img = closed_islands_cleanup(img, bgs)
        img = magenta_free_cleanup(img)
        img = defringe(img, erode=1)
        print(f'keyed: bg={bgs} floodfill+islands+magenta-free+feather', file=sys.stderr)
    if repair:
        from PIL import ImageFilter
        a = np.asarray(img.getchannel('A'), dtype=np.float32)
        a = np.clip((a - 16) / 32 * 255, 0, 255).astype(np.uint8)
        img.putalpha(Image.fromarray(a, 'L'))
        print('repair: alpha hardened', file=sys.stderr)
    return img


# ---------- Normalization (shared output contract) ----------

def normalize_content(img, size, scale=DEFAULT_SCALE, align='bottom'):
    """Normalize one frame: crop transparency, scale content height to size * scale, align, and add transparent margins.
    Return a size-by-size frame whose content occupies the requested ratio and is bottom-aligned or centered."""
    bbox = img.getchannel('A').getbbox()
    if bbox is None:
        return None
    content = img.crop(bbox)
    cw, ch = content.size
    target_h = max(1, int(size * scale))
    s = target_h / ch
    nw = max(1, round(cw * s))
    content = content.resize((nw, target_h), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    px = (size - nw) // 2
    py = size - target_h if align == 'bottom' else (size - target_h) // 2
    out.alpha_composite(content, (px, py))
    return out


def content_ratio(img):
    """Content-height to frame-height ratio, for diagnostics."""
    bbox = img.getchannel('A').getbbox()
    if bbox is None:
        return 0.0
    return (bbox[3] - bbox[1] + 1) / img.height


# ---------- Grid and row-band analysis (retained from the original implementation) ----------

def profile_bounds(mask, axis, n):
    """Find content-aware grid boundaries along axis by splitting at the centers of the widest n-1 interior blank bands."""
    total = mask.sum(axis=axis)
    length = len(total)
    blank = [i for i, v in enumerate(total) if v < 3]
    gaps = []
    if blank:
        start = prev = blank[0]
        for i in blank[1:]:
            if i - prev > 2:
                gaps.append((start, prev))
                start = i
            prev = i
        gaps.append((start, prev))
    mid = [g for g in gaps if g[0] > length * 0.05 and g[1] < length * 0.95]
    if len(mid) < n - 1:
        return None
    mid.sort(key=lambda g: g[1] - g[0], reverse=True)
    cuts = sorted((g[0] + g[1]) // 2 for g in mid[: n - 1])
    return [0] + cuts + [length]


def content_extent_bounds(mask, axis, n):
    """Divide the content range evenly when the profile has no blank bands."""
    total = mask.sum(axis=axis)
    idx = np.nonzero(total > 3)[0]
    if len(idx) < 2:
        return None
    lo, hi = int(idx[0]), int(idx[-1])
    span = hi - lo
    return [lo + round(span * i / n) for i in range(n + 1)]


def detect_grid(img, max_cells=8):
    """Infer the grid by downsampling alpha and finding empty rows and columns."""
    w, h = img.size
    small = img.resize((64, 64), Image.LANCZOS).getchannel('A')
    data = small.load()
    blank_rows = [all(data[x, y] < ALPHA_THRESHOLD for x in range(64)) for y in range(64)]
    blank_cols = [all(data[x, y] < ALPHA_THRESHOLD for y in range(64)) for x in range(64)]

    def segments(blank):
        runs, start = [], None
        for i, b in enumerate(blank):
            if not b and start is None:
                start = i
            elif b and start is not None:
                runs.append((start, i - 1))
                start = None
        if start is not None:
            runs.append((start, len(blank) - 1))
        merged = []
        for run in runs:
            if merged and run[0] - merged[-1][1] <= 2:
                merged[-1] = (merged[-1][0], run[1])
            else:
                merged.append(run)
        return merged

    rows = segments(blank_rows)
    cols = segments(blank_cols)
    if not rows or not cols or len(rows) > max_cells or len(cols) > max_cells:
        return None
    row_bounds = [(round(lo * h / 64), round((hi + 1) * h / 64)) for lo, hi in rows]
    col_bounds = [(round(lo * w / 64), round((hi + 1) * w / 64)) for lo, hi in cols]
    return row_bounds, col_bounds


def row_band_comps(img, row_bounds, row, expand=90, min_area=40):
    """Analyze row-band connected components; components define frames without cropping them to grid cells."""
    from collections import deque
    (yt, yb) = row_bounds[row]
    cy0 = max(0, yt - expand)
    cy1 = min(img.height, yb + expand)
    band = img.crop((0, cy0, img.width, cy1))
    mask = np.asarray(band.getchannel('A')) > 40
    h, w = mask.shape
    visited = np.zeros_like(mask)
    comps = []
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or visited[y0, x0]:
                continue
            area = 0
            minx = maxx = x0
            miny = maxy = y0
            q = deque([(y0, x0)])
            visited[y0, x0] = True
            while q:
                y, x = q.popleft()
                area += 1
                minx = min(minx, x)
                maxx = max(maxx, x)
                miny = min(miny, y)
                maxy = max(maxy, y)
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        q.append((ny, nx))
            if area >= min_area:
                comps.append((area, (minx, miny, maxx, maxy), ((minx + maxx) / 2, (miny + maxy) / 2)))
    comps.sort(key=lambda c: -c[0])
    return band, comps


def build_sheet_from_comps(band, comps, state_centers, my_center, size, row_y0, row_y1, max_frames=0, scale=DEFAULT_SCALE, deco_margin=90):
    """Build a state sheet from row-band components: character and decorations, bottom-centered at the requested content ratio."""
    if not comps:
        return None, 0
    max_area = comps[0][0]
    chars = [(a, bb, ct) for (a, bb, ct) in comps if a > max_area * 0.2]
    if not chars:
        return None, 0
    my_frames = []
    for a, bb, (cx, cy) in chars:
        if not (row_y0 <= cy <= row_y1):
            continue
        nearest = min(range(len(state_centers)), key=lambda i: abs(state_centers[i] - cx))
        if nearest == my_center:
            my_frames.append((a, bb, (cx, cy)))
    my_frames.sort(key=lambda f: f[2][0])
    if max_frames > 0:
        my_frames = my_frames[:max_frames]
    if not my_frames:
        return None, 0
    attach = [[] for _ in my_frames]
    decos = [(a, bb, (cx, cy)) for a, bb, (cx, cy) in comps if a <= max_area * 0.2]
    for a, bb, (cx, cy) in decos:
        hit = None
        for i, (_, cbb, _) in enumerate(my_frames):
            ix = min(bb[2], cbb[2]) - max(bb[0], cbb[0])
            iy = min(bb[3], cbb[3]) - max(bb[1], cbb[1])
            if ix > 1 and iy > 1:
                hit = i
                break
        if hit is not None:
            attach[hit].append(bb)
            continue
        best_i, best_d = None, float('inf')
        for i, (_, cbb, _) in enumerate(my_frames):
            d = abs((cbb[0] + cbb[2]) / 2 - cx) + abs((cbb[1] + cbb[3]) / 2 - cy)
            if d < best_d:
                best_d, best_i = d, i
        if best_i is not None and best_d < deco_margin:
            attach[best_i].append(bb)
    char_h_max = max(bb[3] - bb[1] for _, bb, _ in my_frames)
    if char_h_max <= 0:
        return None, 0
    s = (size * scale) / char_h_max
    crops = []
    for i, (a, cbb, _) in enumerate(my_frames):
        ex0, ey0, ex1, ey1 = cbb
        for dbb in attach[i]:
            ex0 = min(ex0, dbb[0])
            ey0 = min(ey0, dbb[1])
            ex1 = max(ex1, dbb[2])
            ey1 = max(ey1, dbb[3])
        f = band.crop((ex0, ey0, ex1, ey1))
        fw = max(1, round(f.width * s))
        fh = max(1, round(f.height * s))
        if f.size != (fw, fh):
            f = f.resize((fw, fh), Image.LANCZOS)
        crops.append(f)
    SHIFT = 12
    tw = max(f.width for f in crops) + 2 * SHIFT
    th = max(f.height for f in crops) + 2 * SHIFT

    def to_mask(f):
        c = Image.new('L', (tw, th), 0)
        c.paste(f.getchannel('A'), ((tw - f.width) // 2, (th - f.height) // 2))
        return np.asarray(c) > 60

    def mask_centroid(mask):
        ys, xs = np.nonzero(mask)
        return (ys.mean(), xs.mean()) if len(ys) else (0.0, 0.0)

    ref_cent = mask_centroid(to_mask(crops[0]))
    offsets = [(0, 0)]
    for f in crops[1:]:
        m = to_mask(f)
        cy, cx = mask_centroid(m)
        dy = int(np.clip(round(ref_cent[0] - cy), -2, 2))
        dx = int(np.clip(round(ref_cent[1] - cx), -2, 2))
        offsets.append((dx, dy))
    norm = []
    for i, f in enumerate(crops):
        dx, dy = offsets[i]
        px = 128 - f.width // 2 + dx
        py = size - f.height + dy
        px = min(px, size - f.width)
        py = min(py, size - f.height)
        px = max(px, 0)
        py = max(py, 0)
        norm.append((f, px, py))
    sheet = Image.new('RGBA', (size * len(norm), size), (0, 0, 0, 0))
    for i, (f, px, py) in enumerate(norm):
        sheet.paste(f, (i * size + px, py), f)
    return sheet, len(norm)


# ---------- Frame reordering ----------

def reorder_frames(sheet_img, frames, order):
    """Reorder a horizontal frame sheet using order as the target sequence of source indices."""
    if frames <= 1 or order is None:
        return sheet_img
    idx = [int(v) for v in order.split(',')]
    if len(idx) != frames or sorted(idx) != list(range(frames)):
        raise ValueError(f'--swap-frames 必须是 0..{frames - 1} 的排列（当前 {order}）')
    size = sheet_img.height
    frame_imgs = [sheet_img.crop((i * size, 0, (i + 1) * size, size)) for i in range(frames)]
    out = Image.new('RGBA', (size * frames, size), (0, 0, 0, 0))
    for dst, src in enumerate(idx):
        out.paste(frame_imgs[src], (dst * size, 0), frame_imgs[src])
    return out


# ---------- Mode implementations ----------

def mode_single(img, args):
    """Single-state mode: normalize the whole image or each column independently."""
    states = [s.strip() for s in args.states.split(',')] if args.states else None
    n_cols = args.columns or (len(states) if states else 1)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    report = {'input': str(args.input), 'mode': 'single', 'size': list(img.size), 'outputs': []}
    w, h = img.size
    col_w = w // n_cols
    for i in range(n_cols):
        cell = img.crop((i * col_w, 0, w if i == n_cols - 1 else (i + 1) * col_w, h))
        norm = normalize_content(cell, args.size, args.normalize_scale, args.align)
        if norm is None:
            report['outputs'].append({'col': i, 'file': None, 'skipped': 'empty'})
            continue
        # Correct frame order when a single column contains multiple frames.
        if args.swap_frames:
            nf = len(args.swap_frames.split(','))
            norm = reorder_frames(norm, nf, args.swap_frames)
        name = f"{states[i]}.png" if states else f"{Path(args.input).stem}-{i}.png"
        norm.save(out / name)
        report['outputs'].append({'col': i, 'file': name, 'ratio': round(content_ratio(norm), 3)})
    print(json.dumps(report, ensure_ascii=False))
    return report


def mode_grid(img, args):
    """Grid mode: normalize each cell from the declared or automatically detected grid."""
    if args.auto:
        grid = detect_grid(img)
        if grid is None:
            print('auto grid detection failed: 未找到清晰网格（子图需互不重叠、格间留白）', file=sys.stderr)
            sys.exit(1)
        row_bounds, col_bounds = grid
    else:
        rows_s, cols_s = args.grid.lower().split('x')
        rows, cols = int(rows_s), int(cols_s)
        w, h = img.size
        mask = np.asarray(img.getchannel('A')) > 30
        rb = profile_bounds(mask, 0, rows) or content_extent_bounds(mask, 0, rows)
        cb = profile_bounds(mask, 1, cols) or content_extent_bounds(mask, 1, cols)
        if rb is not None and cb is not None:
            row_bounds = [(rb[i], rb[i + 1]) for i in range(rows)]
            col_bounds = [(cb[i], cb[i + 1]) for i in range(cols)]
            print(f'content-aware bounds: rows={rb} cols={cb}', file=sys.stderr)
        else:
            row_bounds = [(round(h * r / rows), round(h * (r + 1) / rows)) for r in range(rows)]
            col_bounds = [(round(w * c / cols), round(w * (c + 1) / cols)) for c in range(cols)]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    layout = [s.strip() for s in args.layout.split(',')] if args.layout else None
    report = {'input': str(args.input), 'mode': 'grid', 'grid': [len(row_bounds), len(col_bounds)], 'slices': []}
    for r, (yt, yb) in enumerate(row_bounds):
        for c, (xl, xr) in enumerate(col_bounds):
            cell = img.crop((xl, yt, xr, yb))
            norm = normalize_content(cell, args.size, args.normalize_scale, args.align)
            if norm is None:
                report['slices'].append({'r': r, 'c': c, 'file': None, 'skipped': 'empty'})
                continue
            name = f'{layout[r * len(col_bounds) + c]}.png' if layout else f'slice-{r}-{c}.png'
            norm.save(out / name)
            report['slices'].append({'r': r, 'c': c, 'file': name, 'ratio': round(content_ratio(norm), 3)})
    print(json.dumps(report, ensure_ascii=False))
    return report


def mode_sheet(img, args):
    """Sheet mode: rows are states and columns are frames; connected components produce one sheet per state."""
    rows_s, cols_s = args.sheet.lower().split('x')
    rows, cols = int(rows_s), int(cols_s)
    w, h = img.size
    mask = np.asarray(img.getchannel('A')) > 30
    rb = profile_bounds(mask, 0, rows) or content_extent_bounds(mask, 0, rows)
    cb = profile_bounds(mask, 1, cols) or content_extent_bounds(mask, 1, cols)
    if rb is not None and cb is not None:
        row_bounds = [(rb[i], rb[i + 1]) for i in range(rows)]
        col_bounds = [(cb[i], cb[i + 1]) for i in range(cols)]
    else:
        row_bounds = [(round(h * r / rows), round(h * (r + 1) / rows)) for r in range(rows)]
        col_bounds = [(round(w * c / cols), round(w * (c + 1) / cols)) for c in range(cols)]
    inset = 4
    row_bounds = [(a + inset, b - inset) for (a, b) in row_bounds if b - a > 2 * inset]
    col_bounds = [(a + inset, b - inset) for (a, b) in col_bounds if b - a > 2 * inset]

    regions = []
    if args.regions:
        for region in args.regions.split(','):
            state, pos = region.split('@')
            row_s, colrange = pos.split(':')
            c0, c1 = (int(v) for v in colrange.split('-'))
            regions.append((state, int(row_s), c0, c1))
    else:
        if not (args.states and args.frames):
            raise SystemExit('--sheet 需要 --states+--frames 或 --regions')
        states = [s.strip() for s in args.states.split(',')]
        frame_counts = [int(v) for v in args.frames.split(',')]
        if len(states) != len(row_bounds) or len(frame_counts) != len(row_bounds):
            raise SystemExit('--states/--frames 数量须等于网格行数')
        regions = [(state, r, 0, fc - 1) for r, (state, fc) in enumerate(zip(states, frame_counts))]

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    report = {'input': str(args.input), 'mode': 'sheet', 'grid': [len(row_bounds), len(col_bounds)], 'sheets': []}
    by_row = {}
    for state, row_s, c0, c1 in regions:
        by_row.setdefault(row_s, []).append((state, c0, c1))
    for row_s, row_states in by_row.items():
        row_states = [(st, c0, c1) for (st, c0, c1) in row_states if st != 'x']
        if not row_states:
            continue
        band, comps = row_band_comps(img, row_bounds, row_s)
        band_off = max(0, row_bounds[row_s][0] - 90)
        row_y0 = row_bounds[row_s][0] - band_off
        row_y1 = row_bounds[row_s][1] - band_off
        state_centers = [(col_bounds[c0][0] + col_bounds[c1][1]) / 2 for _, c0, c1 in row_states]
        for idx, (state, c0, c1) in enumerate(row_states):
            declared = c1 - c0 + 1
            sheet_img, n = build_sheet_from_comps(band, comps, state_centers, idx, args.size, row_y0, row_y1, max_frames=declared, scale=args.normalize_scale)
            if sheet_img is None:
                report['sheets'].append({'state': state, 'file': None, 'frames': 0, 'skipped': 'empty'})
                continue
            if args.swap_frames:
                try:
                    sheet_img = reorder_frames(sheet_img, n, args.swap_frames)
                except ValueError as e:
                    print(f'{state}: {e}', file=sys.stderr)
            fname = f'{state}.png'
            sheet_img.save(out / fname)
            report['sheets'].append({'state': state, 'file': fname, 'frames': n})
    print(json.dumps(report, ensure_ascii=False))
    return report


def main():
    ap = argparse.ArgumentParser(description='AI 生图 → 规范 PNG 资源工具')
    ap.add_argument('input')
    # Modes (choose one).
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument('--single', action='store_true', help='单状态：整图或按列分栏')
    mode.add_argument('--grid', help='网格模式：声明网格 ROWSxCOLS')
    mode.add_argument('--auto', action='store_true', help='网格模式：自动检测')
    mode.add_argument('--sheet', help='sheet 模式：网格 ROWSxCOLS（行=状态列=帧）')
    # Common options.
    ap.add_argument('--key', metavar='BG', help='抠图：gray | auto | R,G,B（多色 | 分隔）')
    ap.add_argument('--repair', action='store_true', help='键后硬化 alpha')
    ap.add_argument('--size', type=int, default=256, help='输出帧边长（默认 256）')
    ap.add_argument('--normalize-scale', type=float, default=DEFAULT_SCALE, help=f'内容占比目标（默认 {DEFAULT_SCALE}：角色高度占帧比例）')
    ap.add_argument('--align', choices=['bottom', 'center'], default='bottom', help='内容对齐（默认 bottom 底对齐）')
    ap.add_argument('--swap-frames', help='帧序校正：目标顺序索引，如 0,2,1')
    ap.add_argument('--out', default='lib/assets/raw/slices', help='输出目录')
    # Single-state mode.
    ap.add_argument('--columns', type=int, help='single 分栏数（左右分栏）')
    ap.add_argument('--states', help='single 分栏/sheet 的状态名（逗号）')
    # Grid mode.
    ap.add_argument('--layout', help='grid 状态名列表（行优先，数量=格子数）')
    # Sheet mode.
    ap.add_argument('--frames', help='sheet 每行帧数（逗号）')
    ap.add_argument('--regions', help='sheet 更灵活：state@row:colStart-colEnd,...')
    ap.add_argument('--crop-margin', type=int, default=0, help='切分前四边裁剪 N px')
    args = ap.parse_args()

    img = Image.open(args.input).convert('RGBA')
    if args.crop_margin > 0:
        img = img.crop((args.crop_margin, args.crop_margin, img.width - args.crop_margin, img.height - args.crop_margin))
        print(f'cropped margin {args.crop_margin}px', file=sys.stderr)
    img = apply_key(img, args.key, args.repair)

    if args.single:
        mode_single(img, args)
    elif args.sheet:
        mode_sheet(img, args)
    else:
        mode_grid(img, args)


if __name__ == '__main__':
    main()
