import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { User, Lock, ArrowRight, LogIn } from "lucide-react";

import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";

function TempleAdminLogin() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username_or_email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  }

  function validateForm() {
    if (!formData.username_or_email.trim()) {
      return "Username or email required.";
    }

    if (!formData.password) {
      return "Password required.";
    }

    return "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const validationError = validateForm();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/accounts/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username_or_email: formData.username_or_email.trim(),
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data?.detail || "Invalid username/email or password.");
        return;
      }

      localStorage.setItem("accessToken", data.access);
      localStorage.setItem("refreshToken", data.refresh);
      localStorage.setItem("user", JSON.stringify(data.user));

      navigate("/temple-admin-dashboard", { replace: true });
    } catch {
      setMessage(
        "Backend server connect avvatledhu. Django server running lo undha check cheyyi."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      activePage="login"
      cardTitle="Temple Admin Login"
      cardDescription="Mee username or email tho login cheyyandi."
      cardIcon={LogIn}
      cardSize="sm"
      footer={
        <>
          <div className="my-4 flex items-center gap-4">
            <span className="h-px flex-1 bg-orange-100" />
            <span className="text-[11px] text-gray-400">OR</span>
            <span className="h-px flex-1 bg-orange-100" />
          </div>

          <p className="text-center text-[13px] text-gray-500">
            New temple admin?{" "}
            <Link to="/admin-register" className="font-bold text-orange-800">
              Create admin account
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-5 space-y-3" noValidate>
        <AuthInput
          icon={User}
          name="username_or_email"
          value={formData.username_or_email}
          onChange={handleChange}
          placeholder="Username or Email"
        />

        <AuthInput
          icon={Lock}
          name="password"
          value={formData.password}
          onChange={handleChange}
          showPasswordToggle
          placeholder="Password"
        />

        {message && (
          <p className="rounded-lg bg-orange-50 px-4 py-2 text-center text-xs text-orange-900">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-orange-800 px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-orange-900 disabled:opacity-70"
        >
          <LogIn className="h-4 w-4" />
          {isLoading ? "Logging in..." : "Login Account"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </AuthLayout>
  );
}

export default TempleAdminLogin;