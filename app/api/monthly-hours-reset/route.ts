import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST() {
  try {
    const supabase = getServiceSupabase();

    // Add 10 hours to all users' additional hours
    const { error } = await supabase
      .from('penalty_records')
      .update({
        additional_hours: supabase.rpc('add_hours', { hours_to_add: 10 })
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Monthly hours reset error:', error);
    return NextResponse.json({ error: 'Monthly hours reset failed' }, { status: 500 });
  }
}