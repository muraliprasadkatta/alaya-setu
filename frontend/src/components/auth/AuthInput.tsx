import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon: LucideIcon;
  showPasswordToggle?: boolean;
};

function AuthInput({
  icon: Icon,
  showPasswordToggle = false,
  type = "text",
  className = "",
  ...props
}: AuthInputProps) {
  const [showValue, setShowValue] = useState(false);

  const inputType = showPasswordToggle
    ? showValue
      ? "text"
      : "password"
    : type;

  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />

      <input
        {...props}
        type={inputType}
        className={`h-10 w-full rounded-lg border border-orange-100 bg-white/85 pl-10 pr-4 text-[13px] text-gray-800 outline-none transition focus:border-orange-700 focus:bg-white ${
          showPasswordToggle ? "pr-10" : ""
        } ${className}`}
      />

      {showPasswordToggle && (
        <button
          type="button"
          onClick={() => setShowValue(!showValue)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        >
          {showValue ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}

export default AuthInput;