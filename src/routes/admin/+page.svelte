<script lang="ts">
  import { onMount } from "svelte";
  import Ringkas from "../../lib/titip/Ringkas.svelte";
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

<section>
  {#if session.pending || loading}
    <p class="text-body text-muted" role="status">Memuat orang…</p>
  {:else if !session.user}
    <h1>Orang</h1>
    <p class="mt-4 text-lead">Masuk sebagai admin untuk mengatur peran.</p>
    <a href="/masuk" class="btn mt-6">Masuk</a>
  {:else if session.role !== "admin"}
    <h1>Orang</h1>
    <p class="mt-4 text-lead">Halaman ini hanya untuk admin, yaitu pengembang.</p>
    <a href="/meja" class="btn mt-6">Ke meja</a>
  {:else}
    <header class="max-w-[40rem]" data-rise style="--i: 0">
      <h1>Orang</h1>
      <p class="mt-4 text-lead">
        Ubah peran klien dan jastiper. Admin tetap satu, dan tidak bisa diturunkan kalau dia satu-satunya.
      </p>
    </header>

    <div class="mt-6" data-reveal>
      <Ringkas compact />
    </div>

    {#if notice}
      <p class="mt-4 text-body text-accent" role="status">{notice}</p>
    {/if}

    {#if people.length === 0}
      <p class="panel mt-6 p-6 text-body text-muted">Belum ada akun lain.</p>
    {:else}
      <ul class="mt-6 flex flex-col gap-3" data-reveal>
        {#each people as person (person.id)}
          <li class="panel p-4">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0">
                <h2 class="truncate text-lead">{person.name || person.email}</h2>
                <p class="truncate text-small text-muted">{person.email}</p>
                <p class="mt-2 text-body">Sekarang: {roleLabel(person.role)}</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <label>
                  <span class="sr-only">Peran {person.name}</span>
                  <select
                    class="field w-40"
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
                </label>
                <button
                  type="button"
                  class="btn disabled:opacity-50"
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
