
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Program = {
  id: string;
  program_code: string;
  program_name: string;
  short_name: string | null;
  program_type: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  description: string | null;
  created_at: string;
  updated_at: string | null;
};

type ProgramForm = {
  program_code: string;
  program_name: string;
  short_name: string;
  program_type: string;
  start_date: string;
  end_date: string;
  status: string;
  description: string;
};

const EMPTY_FORM: ProgramForm = {
  program_code: "",
  program_name: "",
  short_name: "",
  program_type: "",
  start_date: "",
  end_date: "",
  status: "draft",
  description: "",
};

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [form, setForm] = useState<ProgramForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadPrograms();
  }, []);

  async function loadPrograms() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError("Không tải được danh sách chương trình: " + error.message);
      setPrograms([]);
    } else {
      setPrograms((data || []) as Program[]);
    }

    setLoading(false);
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMessage("");
    setError("");
    setShowForm(true);
  }

  function openEditForm(program: Program) {
    setEditingId(program.id);

    setForm({
      program_code: program.program_code || "",
      program_name: program.program_name || "",
      short_name: program.short_name || "",
      program_type: program.program_type || "",
      start_date: program.start_date?.slice(0, 10) || "",
      end_date: program.end_date?.slice(0, 10) || "",
      status: program.status || "",
      description: program.description || "",
    });

    setMessage("");
    setError("");
    setShowForm(true);
  }

  function updateField(
    field: keyof ProgramForm,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function saveProgram() {
    setMessage("");
    setError("");

    if (!form.program_code.trim()) {
      setError("Vui lòng nhập mã chương trình.");
      return;
    }

    if (!form.program_name.trim()) {
      setError("Vui lòng nhập tên chương trình.");
      return;
    }

    if (!form.program_type.trim()) {
      setError("Vui lòng nhập loại chương trình.");
      return;
    }

    if (
      form.start_date &&
      form.end_date &&
      form.start_date > form.end_date
    ) {
      setError("Ngày kết thúc không được trước ngày bắt đầu.");
      return;
    }

    const payload = {
      program_code: form.program_code.trim(),
      program_name: form.program_name.trim(),
      short_name: form.short_name.trim() || null,
      program_type: form.program_type.trim(),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status.trim() || null,
      description: form.description.trim() || null,
    };

    setSaving(true);

    let result;

    if (editingId) {
      result = await supabase
        .from("programs")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);
    } else {
      result = await supabase
        .from("programs")
        .insert(payload);
    }

    if (result.error) {
      setError("Không lưu được chương trình: " + result.error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMessage(
      editingId
        ? "Đã cập nhật chương trình."
        : "Đã tạo chương trình mới."
    );

    await loadPrograms();
  }

  const filteredPrograms = programs.filter((program) => {
    const keyword = search.toLowerCase().trim();

    if (!keyword) return true;

    return (
      program.program_code?.toLowerCase().includes(keyword) ||
      program.program_name?.toLowerCase().includes(keyword) ||
      program.short_name?.toLowerCase().includes(keyword) ||
      program.program_type?.toLowerCase().includes(keyword)
    );
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Cài đặt chương trình
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý thông tin và cấu hình các chương trình Trade.
            </p>
          </div>

          <button
            onClick={openCreateForm}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Tạo chương trình
          </button>
        </div>

        {message && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-800">
              Danh sách chương trình
            </h2>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã CT, tên CT..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:w-72"
            />
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Đang tải dữ liệu...
            </div>
          ) : filteredPrograms.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Chưa có chương trình phù hợp.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="px-3 py-3">Mã CT</th>
                    <th className="px-3 py-3">Tên chương trình</th>
                    <th className="px-3 py-3">Tên viết tắt</th>
                    <th className="px-3 py-3">Loại CT</th>
                    <th className="px-3 py-3">Ngày bắt đầu</th>
                    <th className="px-3 py-3">Ngày kết thúc</th>
                    <th className="px-3 py-3">Trạng thái</th>
                    <th className="px-3 py-3 text-center">Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPrograms.map((program) => (
                    <tr
                      key={program.id}
                      className="border-b last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-3 py-3 font-semibold text-blue-700">
                        {program.program_code}
                      </td>

                      <td className="px-3 py-3 font-medium text-slate-800">
                        {program.program_name}
                      </td>

                      <td className="px-3 py-3 text-slate-600">
                        {program.short_name || "—"}
                      </td>

                      <td className="px-3 py-3 text-slate-600">
                        {program.program_type}
                      </td>

                      <td className="px-3 py-3 text-slate-600">
                        {program.start_date || "—"}
                      </td>

                      <td className="px-3 py-3 text-slate-600">
                        {program.end_date || "—"}
                      </td>

                      <td className="px-3 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                          {program.status || "—"}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => openEditForm(program)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Chỉnh sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 text-xs text-slate-500">
            Tổng số: {filteredPrograms.length} chương trình
          </div>
        </section>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
            <div className="my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">

              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">
                  {editingId ? "Chỉnh sửa chương trình" : "Tạo chương trình mới"}
                </h2>

                <button
                  onClick={() => setShowForm(false)}
                  className="text-2xl text-slate-400 hover:text-slate-700"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Mã chương trình *
                  </label>
                  <input
                    value={form.program_code}
                    onChange={(e) => updateField("program_code", e.target.value)}
                    placeholder="Nhập mã chương trình"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tên viết tắt
                  </label>
                  <input
                    value={form.short_name}
                    onChange={(e) => updateField("short_name", e.target.value)}
                    placeholder="Nhập tên viết tắt"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tên chương trình *
                  </label>
                  <input
                    value={form.program_name}
                    onChange={(e) => updateField("program_name", e.target.value)}
                    placeholder="Nhập tên đầy đủ của chương trình"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Loại chương trình *
                  </label>
                  <input
                    value={form.program_type}
                    onChange={(e) => updateField("program_type", e.target.value)}
                    placeholder="Nhập loại chương trình"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Trạng thái
                  </label>
                  <input
                    value={form.status}
                    onChange={(e) => updateField("status", e.target.value)}
                    placeholder="Ví dụ: draft"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Ngày bắt đầu
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => updateField("start_date", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Ngày kết thúc
                  </label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => updateField("end_date", e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Mô tả
                  </label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="Ghi chú về chương trình..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>

                <button
                  onClick={saveProgram}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Lưu chương trình"}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </main>
  );
}
