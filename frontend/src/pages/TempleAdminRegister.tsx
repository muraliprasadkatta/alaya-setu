import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  User,
  Phone,
  Mail,
  Lock,
  ArrowRight,
} from "lucide-react";

import AuthLayout from "../components/auth/AuthLayout";
import AuthInput from "../components/auth/AuthInput";

function TempleAdminRegister() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: "",
    phone_number: "",
    email: "",
    username: "",
    password: "",
    confirm_password: "",
  });

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;

    if (name === "phone_number") {
      const numbersOnly = value.replace(/\D/g, "").slice(0, 10);
      setFormData({ ...formData, phone_number: numbersOnly });
      return;
    }

    setFormData({ ...formData, [name]: value });
  }

  function validateForm() {
    if (!formData.full_name.trim()) return "Full name required.";

    if (formData.full_name.trim().length < 3) {
      return "Full name must be at least 3 characters.";
    }

    if (!formData.phone_number.trim()) return "Phone number required.";

    if (!/^[6-9]\d{9}$/.test(formData.phone_number)) {
      return "Enter valid 10 digit Indian phone number.";
    }

    if (!formData.email.trim()) return "Email address required.";

    if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      return "Enter valid email address.";
    }

    if (!formData.username.trim()) return "Username required.";

    if (formData.username.trim().length < 4) {
      return "Username must be at least 4 characters.";
    }

    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      return "Username can contain only letters, numbers and underscore.";
    }

    if (!formData.password) return "Password required.";

    if (formData.password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    if (formData.password !== formData.confirm_password) {
      return "Password and confirm password do not match.";
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
      const response = await fetch(
        "http://127.0.0.1:8000/api/accounts/temple-admin/register/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            full_name: formData.full_name.trim(),
            email: formData.email.trim(),
            username: formData.username.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (data.username) {
          setMessage(data.username[0] || "Username already exists.");
          return;
        }

        if (data.email) {
          setMessage(data.email[0] || "Email already exists.");
          return;
        }

        if (data.phone_number) {
          setMessage(data.phone_number[0] || "Phone number already exists.");
          return;
        }

        if (data.confirm_password) {
          setMessage(data.confirm_password[0] || "Passwords do not match.");
          return;
        }

        if (data.detail) {
          setMessage(data.detail);
          return;
        }

        setMessage("Account creation failed. Please check your details.");
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
      activePage="register"
      cardTitle="Temple Member Registration"
      cardDescription="Fill in the details to create your temple management account."
      cardIcon={User}
      cardSize="lg"
      footer={
        <>
          <div className="my-4 flex items-center gap-4">
            <span className="h-px flex-1 bg-orange-100" />
            <span className="text-[11px] text-gray-400">OR</span>
            <span className="h-px flex-1 bg-orange-100" />
          </div>

          <p className="text-center text-[13px] text-gray-500">
            Already have an account?{" "}
            <Link to="/temple-admin-login" className="font-bold text-orange-800">
              Login
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-5 space-y-3" noValidate>
        <AuthInput
          icon={User}
          name="full_name"
          value={formData.full_name}
          onChange={handleChange}
          placeholder="Full Name"
        />

        <AuthInput
          icon={Phone}
          name="phone_number"
          value={formData.phone_number}
          onChange={handleChange}
          inputMode="numeric"
          maxLength={10}
          placeholder="Phone Number"
        />

        <AuthInput
          icon={Mail}
          name="email"
          value={formData.email}
          onChange={handleChange}
          type="email"
          placeholder="Email Address"
        />

        <AuthInput
          icon={User}
          name="username"
          value={formData.username}
          onChange={handleChange}
          placeholder="Username"
        />

        <AuthInput
          icon={Lock}
          name="password"
          value={formData.password}
          onChange={handleChange}
          showPasswordToggle
          placeholder="Password"
        />

        <AuthInput
          icon={Lock}
          name="confirm_password"
          value={formData.confirm_password}
          onChange={handleChange}
          showPasswordToggle
          placeholder="Confirm Password"
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
          <User className="h-4 w-4" />
          {isLoading ? "Creating..." : "Create Account"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </AuthLayout>
  );
}

export default TempleAdminRegister;
