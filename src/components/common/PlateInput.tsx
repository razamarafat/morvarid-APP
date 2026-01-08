
import React, { useState, useEffect } from 'react';
import { toEnglishDigits, toPersianDigits } from '../../utils/dateUtils';
import { AnimatePresence, motion } from 'framer-motion';
import { Icons } from './Icons';

const PERSIAN_LETTERS = [
    'الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'ژ',
    'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ک', 'گ', 'ل', 'م', 'ن', 'و', 'ه', 'ی'
];

interface PlateInputProps {
    value?: string;
    onChange: (plate: string) => void;
    onError?: (error: string | null) => void;
    label?: string;
}

const PlateInput: React.FC<PlateInputProps> = ({ value = '', onChange, onError, label }) => {
    const [parts, setParts] = useState({ part1: '', letter: '', part3: '', part4: '' });
    const [showLetterPicker, setShowLetterPicker] = useState(false);

    // Parse incoming value string "part1-letter-part3-part4"
    useEffect(() => {
        if (!value) {
            setParts({ part1: '', letter: '', part3: '', part4: '' });
            return;
        }
        const split = value.split('-');
        if (split.length === 4) {
            setParts({
                part1: split[0],
                letter: split[1],
                part3: split[2],
                part4: split[3]
            });
        }
    }, [value]);

    // Construct and propagate changes
    const updateParts = (updates: Partial<typeof parts>) => {
        const newParts = { ...parts, ...updates };
        setParts(newParts);

        // Validation Logic
        const isComplete = newParts.part1.length === 2 &&
            newParts.letter.length > 0 &&
            newParts.part3.length === 3 &&
            newParts.part4.length === 2;

        const isEmpty = !newParts.part1 && !newParts.letter && !newParts.part3 && !newParts.part4;

        if (!isEmpty && !isComplete) {
            onError?.('پلاک وارد شده کامل نیست');
        } else {
            onError?.(null);
        }

        // Construct string: "part1-letter-part3-part4"
        // If empty, return empty string
        const finalStr = isEmpty ? '' : `${newParts.part1}-${newParts.letter}-${newParts.part3}-${newParts.part4}`;

        // Prevent infinite loop if value hasn't effectively changed
        if (finalStr !== value) {
            onChange(finalStr);
        }
    };

    return (
        <div className="w-full">
            {label && <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">{label}</label>}
            <div className="grid grid-cols-[1.2fr_auto_1.5fr_auto] gap-2 items-center bg-gray-100 dark:bg-gray-900 p-3 rounded-2xl border-2 border-gray-200 dark:border-gray-700 w-full" dir="ltr">
                {/* Part 1: 2 Digits */}
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={toPersianDigits(parts.part1)}
                    onChange={e => updateParts({ part1: toEnglishDigits(e.target.value) })}
                    className="h-12 lg:h-14 bg-white dark:bg-gray-800 rounded-lg text-center font-black text-xl lg:text-2xl outline-none dark:text-white w-full min-w-0 persian-nums placeholder-gray-400 border border-transparent dark:border-gray-700"
                    placeholder="۲۲"
                />

                {/* Letter */}
                <div className="relative h-12 lg:h-14">
                    <button
                        type="button"
                        onClick={() => setShowLetterPicker(!showLetterPicker)}
                        className="h-full px-2 lg:px-3 bg-white dark:bg-gray-800 rounded-lg font-black text-lg lg:text-xl flex items-center justify-center text-red-600 border border-gray-200 dark:border-gray-700 min-w-[3rem] lg:min-w-[3.5rem] shadow-sm active:scale-95 transition-all"
                    >
                        {parts.letter || 'الف'}
                    </button>
                    <AnimatePresence>
                        {showLetterPicker && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white shadow-xl rounded-xl p-2 grid grid-cols-4 gap-1 w-56 z-50 h-48 overflow-y-auto border border-gray-200"
                            >
                                {PERSIAN_LETTERS.map(l => (
                                    <button
                                        key={l}
                                        type="button"
                                        onClick={() => { updateParts({ letter: l }); setShowLetterPicker(false); }}
                                        className="p-2 hover:bg-gray-100 rounded font-bold text-black text-lg"
                                    >
                                        {l}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Part 3: 3 Digits */}
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={3}
                    value={toPersianDigits(parts.part3)}
                    onChange={e => updateParts({ part3: toEnglishDigits(e.target.value) })}
                    className="h-12 lg:h-14 bg-white dark:bg-gray-800 rounded-lg text-center font-black text-xl lg:text-2xl outline-none dark:text-white w-full min-w-0 persian-nums placeholder-gray-400 border border-transparent dark:border-gray-700"
                    placeholder="۳۶۵"
                />

                {/* Part 4: Iran Code */}
                <div className="flex flex-col items-center justify-center w-12 lg:w-14 h-12 lg:h-14 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                    <span className="text-[8px] font-black text-black dark:text-white">ایران</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        maxLength={2}
                        value={toPersianDigits(parts.part4)}
                        onChange={e => updateParts({ part4: toEnglishDigits(e.target.value) })}
                        className="w-full h-full bg-transparent text-center font-black text-lg lg:text-xl outline-none dark:text-white p-0 -mt-1 persian-nums"
                        placeholder="۱۱"
                    />
                </div>
            </div>
        </div>
    );
};

export default PlateInput;