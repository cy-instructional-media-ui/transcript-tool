import * as Select from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";
import React from "react";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
}

const AccessibleSelect: React.FC<Props> = ({
  id,
  label,
  value,
  onChange,
  options,
  disabled,
}) => {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
        <Select.Trigger
          id={id}
          aria-label={label}
          className="
            w-full p-2.5 bg-white border border-gray-300 rounded-lg
            flex items-center justify-between text-gray-900 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500
          "
        >
          {/* THIS is what shows the selected option */}
          <Select.Value />
          <Select.Icon>
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className="
              bg-white border border-gray-300 rounded-lg shadow-lg
              max-h-60 overflow-y-auto z-50
            "
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                const trigger = document.getElementById(id);
                trigger?.focus();

                // Close via synthetic Escape
                const evt = new KeyboardEvent("keydown", { key: "Escape" });
                trigger?.dispatchEvent(evt);
              }
            }}
          >
            <Select.Viewport className="p-2">
              {options.map((opt) => (
                <Select.Item
                  value={opt}
                  key={opt}
                  className="
                    text-sm text-gray-800 rounded-md p-2 cursor-pointer
                    focus:bg-blue-100 focus:outline-none
                    data-[state=checked]:bg-blue-200
                  "
                >
                  {/* THIS is what makes the visible text appear */}
                  <Select.ItemText>{opt}</Select.ItemText>

                  <Select.ItemIndicator className="absolute right-2 inline-flex items-center">
                    <CheckIcon />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
};

export default AccessibleSelect;
