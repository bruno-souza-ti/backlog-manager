import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Static classes, or a function of the current value — the two urgency selects recolor themselves per selected option. */
  triggerClassName?: string | ((value: string) => string);
  id?: string;
  "aria-label"?: string;
}

/** Radix forbids an empty-string Item value (it's reserved to mean "cleared") — a few call sites use "" for a real "none" option (Sem Cliente, Sem Responsável, Sem Sprint), so it's swapped for this sentinel at the boundary, transparently to callers. */
const EMPTY_VALUE_SENTINEL = "__none__";

const CONTENT_CLASSES =
  "z-[70] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900";
const VIEWPORT_CLASSES = "max-h-72 p-1";
const ITEM_CLASSES =
  "relative flex cursor-pointer select-none items-center gap-2 rounded-lg py-2 pl-7 pr-3 text-sm text-slate-700 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-teal-50 data-[highlighted]:text-teal-700 dark:text-zinc-300 dark:data-[highlighted]:bg-teal-950/40 dark:data-[highlighted]:text-teal-400";

export default function Select({ value, onChange, options, placeholder, disabled, triggerClassName, id, ...aria }: SelectProps) {
  const radixValue = value === "" ? EMPTY_VALUE_SENTINEL : value;
  const resolvedTriggerClassName = typeof triggerClassName === "function" ? triggerClassName(value) : triggerClassName;

  return (
    <RadixSelect.Root
      value={radixValue}
      onValueChange={(next) => onChange(next === EMPTY_VALUE_SENTINEL ? "" : next)}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        id={id}
        aria-label={aria["aria-label"]}
        className={`flex w-full items-center justify-between gap-2 outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-slate-400 dark:data-[placeholder]:text-zinc-500 ${resolvedTriggerClassName || ""}`}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className={CONTENT_CLASSES} position="popper" sideOffset={4}>
          <RadixSelect.Viewport className={VIEWPORT_CLASSES}>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value === "" ? EMPTY_VALUE_SENTINEL : option.value}
                disabled={option.disabled}
                className={ITEM_CLASSES}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <RadixSelect.ItemIndicator>
                    <Check className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  </RadixSelect.ItemIndicator>
                </span>
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
