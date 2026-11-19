import { NextResponse } from 'next/server';
import { getSupabase, BUCKET } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';

const MAX_SIZE = 4 * 1024 * 1024; // 4MB，Vercel 单次请求上限 4.5MB
const ALLOWED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/aac'
];

/** 按文件头识别真实格式，避免后缀/类型与实际内容不一致导致图片打不开 */
function sniffType(buffer) {
  const b = buffer;
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (b.length > 6 && b.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  if (b.length > 12 && b.toString('ascii', 4, 8) === 'ftyp') return 'audio/mp4';
  if (b.length > 4 && b.toString('ascii', 0, 4) === 'OggS') return 'audio/ogg';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE') return 'audio/wav';
  if (b.length > 4 && b.toString('ascii', 0, 4) === 'fLaC') return 'audio/ogg';
  return null;
}

/** 上传配图到 Supabase Storage */
export async function POST(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: '没有收到图片文件' }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: '只支持 jpg / png / webp / gif 格式' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: '图片不能超过 4MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // 以文件头为准：浏览器/安卓传上来的 png 常被标成 jpg，落库后就会显示成空白
    const sniffed = sniffType(buffer);
    const type = sniffed && ALLOWED.includes(sniffed) ? sniffed : file.type;
    const ext = (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace('mpeg', 'mp3');
    const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const supabase = getSupabase();
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: type,
      upsert: false
    });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e) {
    return NextResponse.json({ error: '上传失败：' + e.message }, { status: 500 });
  }
}
