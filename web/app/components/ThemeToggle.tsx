"use client";

import { Box, Flex, Tooltip } from "@chakra-ui/react";
import { useThemeMode } from "./ThemeContext";
import { motion, AnimatePresence } from "framer-motion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionBox = motion.create(Box as any);

export default function ThemeToggle({ size = "md" }: { size?: "sm" | "md" }) {
    const { isDark, toggleTheme, t } = useThemeMode();
    const dim = size === "sm" ? 32 : 38;
    const iconSize = size === "sm" ? 16 : 20;

    return (
        <Tooltip label={isDark ? "Switch to Light" : "Switch to Dark"} placement="bottom" hasArrow
            bg={t.tooltipBg} color={t.tooltipColor} fontSize="xs" borderRadius="8px">
            <Flex
                as="button"
                onClick={toggleTheme}
                align="center"
                justify="center"
                w={`${dim}px`}
                h={`${dim}px`}
                borderRadius="12px"
                bg={t.toggleBg}
                border="1px solid"
                borderColor={t.toggleBorder}
                cursor="pointer"
                position="relative"
                overflow="hidden"
                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                _hover={{
                    borderColor: isDark ? "#f59e0b" : "#6366f1",
                    bg: t.toggleHoverBg,
                    transform: "scale(1.08)",
                    boxShadow: isDark
                        ? "0 0 20px rgba(245, 158, 11, 0.25)"
                        : "0 0 20px rgba(99, 102, 241, 0.25)",
                }}
                _active={{ transform: "scale(0.95)" }}
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
                <AnimatePresence mode="wait" initial={false}>
                    {isDark ? (
                        <MotionBox
                            key="sun"
                            initial={{ rotate: -90, scale: 0, opacity: 0 }}
                            animate={{ rotate: 0, scale: 1, opacity: 1 }}
                            exit={{ rotate: 90, scale: 0, opacity: 0 }}
                            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                        >
                            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" />
                                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
                                    const rad = (angle * Math.PI) / 180;
                                    const x1 = 12 + 7.5 * Math.cos(rad);
                                    const y1 = 12 + 7.5 * Math.sin(rad);
                                    const x2 = 12 + 9.5 * Math.cos(rad);
                                    const y2 = 12 + 9.5 * Math.sin(rad);
                                    return (
                                        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                                            stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                                    );
                                })}
                            </svg>
                        </MotionBox>
                    ) : (
                        <MotionBox
                            key="moon"
                            initial={{ rotate: 90, scale: 0, opacity: 0 }}
                            animate={{ rotate: 0, scale: 1, opacity: 1 }}
                            exit={{ rotate: -90, scale: 0, opacity: 0 }}
                            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                        >
                            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                                    fill="#6366f1"
                                    stroke="#818cf8"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <circle cx="17" cy="7" r="1" fill="#c4b5fd" opacity="0.7" />
                                <circle cx="19" cy="11" r="0.7" fill="#c4b5fd" opacity="0.5" />
                            </svg>
                        </MotionBox>
                    )}
                </AnimatePresence>

                {/* Glow ring animation on toggle */}
                <Box
                    position="absolute"
                    inset="-2px"
                    borderRadius="14px"
                    bg="transparent"
                    border="2px solid"
                    borderColor={isDark ? "rgba(251, 191, 36, 0.0)" : "rgba(99, 102, 241, 0.0)"}
                    transition="border-color 0.5s ease"
                    pointerEvents="none"
                />
            </Flex>
        </Tooltip>
    );
}
