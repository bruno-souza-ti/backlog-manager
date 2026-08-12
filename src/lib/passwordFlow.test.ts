import { describe, expect, it } from "vitest";
import { detectPasswordFlow, passwordFlowFromAuthEvent, passwordRedirectUrl, validateNewPassword } from "./passwordFlow";

describe("passwordFlow", () => {
  it("detecta primeiro acesso e recuperação pela rota dedicada", () => {
    expect(detectPasswordFlow({ pathname: "/auth/setup-password", search: "", hash: "" })).toBe("invite");
    expect(detectPasswordFlow({ pathname: "/auth/update-password", search: "", hash: "" })).toBe("recovery");
  });

  it("mantém compatibilidade com links implícitos que informam o tipo", () => {
    expect(detectPasswordFlow({ pathname: "/", search: "", hash: "#type=invite&access_token=secret" })).toBe("invite");
    expect(detectPasswordFlow({ pathname: "/", search: "?type=recovery", hash: "" })).toBe("recovery");
  });

  it("não bloqueia um login normal", () => {
    expect(detectPasswordFlow({ pathname: "/", search: "", hash: "" })).toBeNull();
    expect(passwordFlowFromAuthEvent("SIGNED_IN")).toBeNull();
    expect(passwordFlowFromAuthEvent("PASSWORD_RECOVERY")).toBe("recovery");
  });

  it("valida tamanho e confirmação da senha", () => {
    expect(validateNewPassword("curta", "curta")).toContain("8 caracteres");
    expect(validateNewPassword("senha-segura", "outra-senha")).toContain("não coincidem");
    expect(validateNewPassword("senha-segura", "senha-segura")).toBeNull();
  });

  it("gera o redirect de recuperação sem depender da rota atual", () => {
    expect(passwordRedirectUrl("https://app.example.com")).toBe("https://app.example.com/auth/update-password");
  });
});
