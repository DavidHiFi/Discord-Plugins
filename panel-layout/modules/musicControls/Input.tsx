/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { TextInput, useState } from "@webpack/common";

/**
 * Text input that keeps its own draft state and only reports a value once focus leaves,
 * so a store write does not fire on every keystroke.
 */
export function Input({ initialValue, onChange, placeholder, style }: {
    placeholder: string;
    initialValue: string;
    onChange(value: string): void;
    style?: React.CSSProperties;
}) {
    const [value, setValue] = useState(initialValue);

    return (
        <TextInput
            placeholder={placeholder}
            value={value}
            onChange={setValue}
            spellCheck={false}
            style={style}
            onBlur={() => {
                if (value !== initialValue) onChange(value);
            }}
        />
    );
}
