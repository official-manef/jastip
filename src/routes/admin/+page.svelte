<script lang="ts">
  import { onMount } from "svelte";
  import { ROLES, roleLabel, type Role } from "../../lib/titip/roles";
  import { authedFetch, loadMe, session } from "../../lib/titip/session.svelte";

  type Person = { id: string; name: string; email: string; role: Role | null };

  let people = $state<Person[]>([]);
  let draft = $state<Record<string, Role>>({});
  let loading = $state(true);
  let notice = $state("");
  let saving = $state("");

  const satuAdmin = $derived(people.filter((person) => person.role === "admin").length <= 1);

  function pesan(error: string | undefined): string {
    if (error === "admin-taken") return "Hanya satu admin. Peran itu sudah terisi.";
    if (error === "admin-terakhir") return "Admin terakhir tidak bisa diturunkan.";
    if (error === "tidak-ada") return "Akun itu tidak ada.";
    return "Peran belum berubah.";
  }

  async function muat() {
    loading = true;
    notice = "";
    try {
      const res = await authedFetch("/api/admin");
      const data = (await res.json()) as { people?: Person[]; error?: string };
      if (!res.ok) {
        notice = data.error === "bukan-admin" ? "Hanya admin." : "Daftar orang belum terbaca.";
        people = [];
        return;
      }
      people = data.people ?? [];
      draft = Object.fromEntries(people.map((person) => [person.id, person.role ?? "klien"]));
    } catch {
      notice = "Daftar orang belum terbaca.";
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void (async () => {
      await loadMe();
      if (session.role === "admin") await muat();
      else loading = false;
    })();
  });

  async function simpan(person: Person) {
    const role = draft[person.id];
    if (!role || saving) return;
    saving = person.id;
    notice = "";
    try {
      const res = await authedFetch("/api/admin", {
        method: "POST",
        body: JSON.stringify({ userId: person.id, role }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        notice = pesan(data.error);
        return;
      }
      await muat();
    } catch {
      notice = "Peran belum berubah.";
    } finally {
      saving = "";
    }
  }

  function pilih(id: string, value: string) {
    if (value !== "klien" && value !== "jastiper" && value !== "admin") return;
    draft = { ...draft, [id]: value };
  }
</script>

<section class="mx-auto max-w-3xl">
  {#if session.pending || loading}
    <div class="h-9 w-40 animate-pulse rounded-lg bg-line" aria-hidden="true"></div>
    <div class="mt-4 h-28 animate-pulse rounded-2xl bg-line" aria-hidden="true"></div>
    <p class="sr-only">Memuat orang</p>
  {:else if !session.user}
    <h1 class="font-display text-4xl italic">Orang</h1>
    <p class="mt-3 text-muted">Masuk sebagai admin untuk mengatur peran.</p>
    <a href="/masuk" class="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-fg">Masuk</a>
  {:else if session.role !== "admin"}
    <h1 class="font-display text-4xl italic">Orang</h1>
    <p class="mt-3 text-muted">Halaman ini hanya untuk admin, yaitu pengembang.</p>
    <a href="/" class="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-fg">Ke meja</a>
  {:else}
    <p class="text-sm font-medium tracking-wide text-primary uppercase">Pengembang</p>
    <h1 class="mt-1 font-display text-4xl italic">Orang</h1>
    <p class="mt-3 text-muted">Ubah peran klien dan jastiper. Admin tetap satu, dan tidak bisa diturunkan kalau dia satu-satunya.</p>

    {#if notice}
      <p class="mt-4 text-sm text-accent" role="status">{notice}</p>
    {/if}

    {#if people.length === 0}
      <p class="mt-6 rounded-2xl border border-dashed border-line bg-surface px-4 py-8 text-center text-muted">Belum ada akun lain.</p>
    {:else}
      <ul class="mt-6 grid gap-3">
        {#each people as person (person.id)}
          <li class="rounded-2xl border border-border bg-surface p-4 shadow-ticket">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="truncate font-display text-2xl italic">{person.name || person.email}</h2>
                <p class="truncate text-sm text-muted">{person.email}</p>
                <p class="mt-1 text-sm">Sekarang: {roleLabel(person.role)}</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <label class="sr-only" for={"peran-" + person.id}>Peran {person.name}</label>
                <select
                  id={"peran-" + person.id}
                  class="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm"
                  value={draft[person.id] ?? "klien"}
                  onchange={(event) => pilih(person.id, event.currentTarget.value)}
                >
                  {#each ROLES as item (item.id)}
                    <option
                      value={item.id}
                      disabled={(item.id === "admin" && person.role !== "admin") || (person.role === "admin" && satuAdmin && item.id !== "admin")}
                    >
                      {item.label}
                    </option>
                  {/each}
                </select>
                <button
                  type="button"
                  class="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-fg disabled:opacity-50"
                  disabled={saving === person.id}
                  onclick={() => simpan(person)}
                >
                  {saving === person.id ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>
