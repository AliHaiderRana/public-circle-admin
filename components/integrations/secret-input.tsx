'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

type SecretInputProps = {
  id: string;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  readOnly?: boolean;
};

export function SecretInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  helperText,
  readOnly = false,
}: SecretInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? 'Hide secret' : 'Show secret'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {helperText ? <p className="text-sm text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}
