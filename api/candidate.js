const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { createAdminClient } = require("../lib/api-supabase");

const MAX_BYTES = 3 * 1024 * 1024;
const ACCEPTED = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const required = ["full_name", "email", "phone", "position", "cv_filename", "cv_base64"];
  if (required.some((field) => typeof body[field] !== "string" || !body[field].trim())) {
    return res.status(400).json({ error: "Completa los datos y adjunta tu CV." });
  }

  const filename = path.basename(body.cv_filename).slice(0, 160);
  const extension = path.extname(filename).toLowerCase();
  const contentType = ACCEPTED[extension];
  if (!contentType || (body.cv_type !== contentType && body.cv_type !== "application/octet-stream")) {
    return res.status(400).json({ error: "El CV debe estar en formato PDF, DOC o DOCX." });
  }
  const bytes = Buffer.from(body.cv_base64, "base64");
  if (!bytes.length || bytes.length > MAX_BYTES) {
    return res.status(400).json({ error: "El CV debe ocupar menos de 3 MB." });
  }
  const signatureValid = extension === ".pdf"
    ? bytes.subarray(0, 5).toString() === "%PDF-"
    : extension === ".doc"
      ? bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
      : bytes.subarray(0, 2).toString() === "PK";
  if (!signatureValid) return res.status(400).json({ error: "El contenido del archivo no coincide con su formato." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return res.status(400).json({ error: "Introduce un email válido." });
  }

  const objectPath = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
  try {
    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from("candidate-cvs")
      .upload(objectPath, bytes, { contentType, upsert: false });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("candidate_applications")
      .insert({
        full_name: body.full_name.trim(),
        email: body.email.trim().toLowerCase(),
        phone: body.phone.trim(),
        position: body.position.trim(),
        linkedin_url: String(body.linkedin_url || "").trim() || null,
        experience_years: Math.max(0, Number.parseInt(body.experience_years, 10) || 0),
        cv_path: objectPath,
        cv_filename: filename,
      })
      .select("id")
      .single();

    if (error) {
      await supabase.storage.from("candidate-cvs").remove([objectPath]);
      throw error;
    }
    return res.status(201).json({ ok: true, id: data.id });
  } catch (error) {
    console.error("Candidate intake failed:", error.message);
    if (error.code === "SUPABASE_CONFIG_MISSING") {
      return res.status(503).json({ error: error.message });
    }
    if (["PGRST205", "42P01", "BucketNotFound"].includes(error.code) || /schema cache|could not find (the )?table|relation .* does not exist|bucket not found/i.test(error.message || "")) {
      return res.status(503).json({ error: "The candidate table or CV storage bucket is missing from the configured Supabase database. Apply the branch migration to the intended development database, then refresh its API schema cache." });
    }
    return res.status(500).json({ error: "No se pudo enviar tu candidatura. Inténtalo de nuevo." });
  }
};
