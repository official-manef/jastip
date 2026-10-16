import test from "node:test";
import assert from "node:assert/strict";
import {
  CUSTOM_KODE,
  DESTINASI,
  destinasiByCode,
  destinasiPerKawasan,
  customKode,
  customToView,
  viewOf,
} from "./destinasi.ts";

test("katalog menutup banyak negara, kode unik, mata uang & kawasan terisi", () => {
  assert.ok(DESTINASI.length >= 25, `katalog harus >= 25 negara, dapat ${DESTINASI.length}`);
  const kode = new Set<string>();
  for (const d of DESTINASI) {
    assert.ok(!kode.has(d.code), `kode duplikat: ${d.code}`);
    kode.add(d.code);
    assert.ok(d.currency, `${d.code} harus punya mata uang`);
    assert.ok(d.kurs > 0, `${d.code} harus punya kurs > 0`);
    assert.ok(d.kawasan, `${d.code} harus punya kawasan`);
    assert.ok(d.kota, `${d.code} harus punya kota`);
  }
});

test("setiap kawasan punya minimal satu negara dan urut sesuai katalog", () => {
  const grup = destinasiPerKawasan();
  assert.ok(grup.length >= 6, `harus >= 6 kawasan, dapat ${grup.length}`);
  for (const g of grup) assert.ok(g.items.length > 0, `kawasan ${g.kawasan} kosong`);
  const total = grup.reduce((n, g) => n + g.items.length, 0);
  assert.equal(total, DESTINASI.length);
});

test("viewOf mengembalikan view katalog, custom, dan titik asal", () => {
  const jp = viewOf("jepang");
  assert.equal(jp?.currency, "JPY");
  assert.equal(jp?.custom, false);
  assert.equal(jp?.code, "jepang");

  const asal = viewOf("jakarta");
  assert.equal(asal?.currency, "IDR");
  assert.equal(asal?.kota, "Jakarta");

  const cv = customToView(customKode("Brunei Darussalam"), { negara: "Brunei Darussalam", kota: "Bandar Seri Begawan", currency: "SGD", kurs: 11800 });
  assert.equal(cv.custom, true);
  assert.equal(cv.currency, "SGD");
  assert.equal(cv.kota, "Bandar Seri Begawan");

  assert.equal(viewOf(customKode("X"), { negara: "X", kota: "X", currency: "USD", kurs: 15800 })?.custom, true);
});

test("kode custom stabil dan aman jadi id", () => {
  assert.equal(customKode("Brunei Darussalam"), "custom:brunei-darussalam");
  assert.equal(customKode("  Panama!! "), "custom:panama");
  assert.equal(customKode(""), "custom:negara");
  assert.ok(CUSTOM_KODE.startsWith("__"));
  assert.equal(destinasiByCode(customKode("Panama")), undefined);
});
