import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load profile: ${error.message}`);
  }

  const needsName = !profile?.first_name || !profile?.last_name;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
          {needsName ? "One more step" : "Account settings"}
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-6xl">
          {needsName ? "Complete your profile" : "Profile"}
        </h1>
        <p className="mt-4 text-slate-300">
          Add your name and an optional photo. Images are stored in Supabase Storage, not in the database.
        </p>

        <form action={updateProfile} className="mt-10 space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8">
          {profile?.avatar_url && (
            <div
              role="img"
              aria-label="Current profile photo"
              className="h-24 w-24 rounded-full bg-cover bg-center ring-4 ring-emerald-300/20"
              style={{ backgroundImage: `url(${profile.avatar_url})` }}
            />
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold">First name</span>
              <input
                name="firstName"
                defaultValue={profile?.first_name ?? ""}
                required
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-3 outline-none focus:border-emerald-300"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold">Last name</span>
              <input
                name="lastName"
                defaultValue={profile?.last_name ?? ""}
                required
                className="w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-3 outline-none focus:border-emerald-300"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">Profile photo</span>
            <input
              name="avatar"
              type="file"
              accept="image/*"
              className="block w-full rounded-xl border border-dashed border-white/20 p-4 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-300 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
            />
            <span className="block text-xs text-slate-400">Optional · image files up to 5 MB</span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl bg-emerald-300 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-200">
              Save profile
            </button>
            {!needsName && (
              <Link href="/protected" className="rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/10">
                Cancel
              </Link>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}
