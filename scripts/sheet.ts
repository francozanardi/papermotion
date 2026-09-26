/**
 * A contact sheet of a rendered video, to judge timing and motion at a glance.
 *
 *   pnpm sheet <example> [fps=2] [from=0] [seconds=10]   → out/<example>_sheet_<from>.jpg
 */
import { execFileSync } from 'node:child_process';

const [name, fps = '2', from = '0', span = '10'] = process.argv.slice(2);
if (!name) { console.error('usage: pnpm sheet <example> [fps] [from] [seconds]'); process.exit(1); }
const out = `out/${name}_sheet_${from}.jpg`, cols = 5, rows = Math.ceil((Number(fps) * Number(span)) / cols);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', from, '-t', span, '-i', `out/${name}.mp4`, '-vf',
  `fps=${fps},scale=384:-1,drawtext=text='%{pts\\:hms}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.6,tile=${cols}x${rows}`, '-frames:v', '1', out]);
console.log(`sheet → ${out}`);
