"use client";

import { ChakraProvider, extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
    config: {
        initialColorMode: "dark",
        useSystemColorMode: false,
    },
    styles: {
        global: {
            "html, body": {
                bg: "#0a0a0f",
                color: "#e2e8f0",
            },
            "::-webkit-scrollbar": {
                width: "6px",
            },
            "::-webkit-scrollbar-track": {
                bg: "#1a1a2e",
            },
            "::-webkit-scrollbar-thumb": {
                bg: "#4a4a6a",
                borderRadius: "3px",
            },
        },
    },
    colors: {
        brand: {
            50: "#e6f0ff",
            100: "#b3d1ff",
            200: "#80b3ff",
            300: "#4d94ff",
            400: "#1a75ff",
            500: "#0066ff",
            600: "#0052cc",
            700: "#003d99",
            800: "#002966",
            900: "#001433",
        },
    },
    fonts: {
        heading: `'Inter', -apple-system, sans-serif`,
        body: `'Inter', -apple-system, sans-serif`,
    },
    components: {
        Button: {
            defaultProps: {
                colorScheme: "brand",
            },
        },
    },
});

export default function Providers({ children }: { children: React.ReactNode }) {
    return <ChakraProvider theme={theme}>{children}</ChakraProvider>;
}
