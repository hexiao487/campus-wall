import { NextResponse } from 'next/server';
import { getSupabase, BUCKET } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';

// Vercel 单次请求上限 4.5MB，视频走「签名直传」绕开它：服务端签发直传地址，浏览器直接传到 Supabase Storage
const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];

const EXT = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v'
};

/** 申请视频直传地址（需登录） */
export async function POST(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const type = String(body.type || '').split(';')[0].trim().toLowerCase();
    const size = Number(body.size || 0);

    if (!ALLOWED.includes(type)) {
      return NextResponse.json({ error: '只支持 mp4 / mov / webm 视频' }, { status: 400 });
    }
    if (!size) return NextResponse.json({ error: '没有收到视频文件' }, { status: 400 });
    if (size > MAX_SIZE) {
      return NextResponse.json({ error: '视频不能超过 50MB，先用相册/剪辑 App 压一下再传' }, { status: 400 });
    }

    const supabase = getSupabase();
    const path = `video/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${EXT[type] || 'mp4'}`;

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw new Error(error.message);

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ signedUrl: data.signedUrl, path, url: pub.publicUrl });
  } catch (e) {
    return NextResponse.json({ error: '申请上传地址失败：' + e.message }, { status: 500 });
  }
}
