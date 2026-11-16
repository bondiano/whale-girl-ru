#!/usr/bin/env python3
"""Generate README preview GIFs from state sheets using each manifest playback mode.

Output: docs/preview/<state>.gif. Frame order follows loop, pingpong, once (hold the last frame),
or blink (hold frame zero, then perform one action). Limit each preview to about 12 frames for a small file.
Dependencies: Pillow and numpy, as with scripts/slice-sheet.py.
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, 'lib', 'assets', 'manifest.json')
CHAR_DIR = os.path.join(ROOT, 'lib', 'assets', 'characters', 'whale-girl')
OUT_DIR = os.path.join(ROOT, 'docs', 'preview')

# Maximum output frames per state, limiting GIF size; number of held final frames for once mode.
MAX_FRAMES = 8
HOLD_FRAMES = 3
PREVIEW_SCALE = 0.5  # 256px to 128px for README table previews; hold the final once frame or the default blink frame zero.


def frame_sequence(frames, playback):
    """Build the zero-based frame sequence for the playback mode."""
    if frames == 1:
        return [0]
    if playback == 'pingpong':
        seq = list(range(frames)) + list(range(frames - 2, 0, -1))
        return seq
    if playback == 'once':
        return list(range(frames)) + [frames - 1] * HOLD_FRAMES
    if playback == 'blink':
        # Hold default frame zero, then perform one action: 0 to 1 to N-1 and back to 0.
        return [0] * HOLD_FRAMES + list(range(1, frames)) + [0]
    # Loop until MAX_FRAMES is reached.
    return [i % frames for i in range(MAX_FRAMES)]


def main():
    with open(MANIFEST, encoding='utf-8') as f:
        manifest = json.load(f)
    states = manifest['characters']['whale-girl']['states']
    os.makedirs(OUT_DIR, exist_ok=True)
    previews = {}
    for name, cfg in sorted(states.items()):
        sheet_path = os.path.join(CHAR_DIR, cfg['sheet'])
        if not os.path.exists(sheet_path):
            print(f'[skip] {name}: {cfg["sheet"]} 缺失', file=sys.stderr)
            continue
        sheet = Image.open(sheet_path)
        fw = sheet.width // cfg['frames']
        seq = frame_sequence(cfg['frames'], cfg['playback'])
        duration = max(60, int(1000 / cfg['fps']))
        # GIF transparency is one-bit; quantized transparent or semitransparent pixels can produce black edges/backgrounds.
        # Composite RGBA frames onto white before saving, keeping README previews clean in light and dark themes.
        frames = []
        for idx in seq:
            f = sheet.crop((fw * idx, 0, fw * (idx + 1), sheet.height)).convert('RGBA')
            bg = Image.new('RGBA', f.size, (255, 255, 255, 255))
            frames.append(Image.alpha_composite(bg, f).convert('RGB').resize((int(f.width * PREVIEW_SCALE), int(f.height * PREVIEW_SCALE)), Image.LANCZOS))
        out = os.path.join(OUT_DIR, f'{name}.gif')
        frames[0].save(out, save_all=True, append_images=frames[1:], duration=duration, loop=0, disposal=2)
        previews[name] = out
        print(f'[ok] {name}: {len(seq)} 帧 @ {duration}ms -> {os.path.basename(out)}')
    # Print the state list used by the README table.
    print('\nPREVIEWS=' + ','.join(previews))


if __name__ == '__main__':
    main()
