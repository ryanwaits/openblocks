"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";

const PRESET_COLORS = [
  "#fef08a", // yellow
  "#bbf7d0", // green
  "#bfdbfe", // blue
  "#fecaca", // red
  "#e9d5ff", // purple
  "#fed7aa", // orange
  "#fbcfe8", // pink
  "#ccfbf1", // teal
];

interface ColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

export function ColorPicker({ currentColor, onColorChange }: ColorPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
          <Palette className="h-4 w-4" />
          <div
            className="h-3.5 w-3.5 rounded-full ring-1 ring-gray-300"
            style={{ backgroundColor: currentColor }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" side="top">
        <div className="grid grid-cols-4 gap-1.5">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              className="h-7 w-7 rounded-full ring-1 ring-gray-200 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: color,
                outline: color === currentColor ? "2px solid #3b82f6" : "none",
                outlineOffset: "2px",
              }}
              onClick={() => onColorChange(color)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
