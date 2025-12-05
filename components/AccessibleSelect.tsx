import React, { useState, useRef, useEffect } from "react";

interface Option {
  label: string;
  value: string;
}

interface AccessibleSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
}

export default function AccessibleSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: AccessibleSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        !buttonRef.current?.contains(e.target as Node) &&
        !listRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Handle keyboard interactions
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case "Tab":
        // REQUIRED by ADA Title II — close menu before tabbing out
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) =>
          i === null || i === options.length - 1 ? 0 : i + 1
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) =>
          i === null || i === 0 ? options.length - 1 : i - 1
        );
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (activeIndex !== null) {
          onChange(options[activeIndex].value);
          setOpen(false);
          buttonRef.current?.focus();
        }
        break;
      case "Home":
        setActiveIndex(0);
        break;
      case "End":
        setActiveIndex(options.length - 1);
        break;
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex === null) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div className="w-full">
      <label className="block mb-1 text-sm font-medium text-gray-800">
        {label}
      </label>

      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls="accessible-listbox"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="w-full bg-white border border-gray-400 px-3 py-2 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
        >
          {selectedOption?.label}
        </button>

        {open && (
          <ul
            id="accessible-listbox"
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            className="absolute z-20 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg"
            onKeyDown={handleKeyDown}
          >
            {options.map((opt, index) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={`px-3 py-2 cursor-pointer
                  ${
                    index === activeIndex
                      ? "bg-blue-600 text-white"
                      : opt.value === value
                      ? "bg-blue-50"
                      : "hover:bg-gray-100"
                  }
                `}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
