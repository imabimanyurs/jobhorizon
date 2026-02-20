"use client";

import { Box, Flex, HStack, Skeleton } from "@chakra-ui/react";

export default function JobCardSkeleton() {
    return (
        <Box
            bg="#12121f"
            border="1px solid #1e1e3a"
            borderRadius="16px"
            h="130px"
            overflow="hidden"
            position="relative"
        >
            {/* Accent line */}
            <Box position="absolute" left={0} top="14px" bottom="14px" w="3px" borderRadius="0 2px 2px 0">
                <Skeleton h="100%" startColor="#1e1e3a" endColor="#2a2a4a" />
            </Box>

            {/* Row 1: Title + Actions */}
            <Flex justify="space-between" align="flex-start" px={6} pt={5} pb={3} gap={4}>
                <Box flex={1}>
                    <Skeleton h="18px" w="70%" startColor="#1e1e3a" endColor="#2a2a4a" borderRadius="6px" mb={2} />
                    <HStack spacing={2}>
                        <Skeleton h="14px" w="100px" startColor="#1e1e3a" endColor="#2a2a4a" borderRadius="4px" />
                        <Box w="3px" h="3px" borderRadius="full" bg="#1e1e3a" />
                        <Skeleton h="14px" w="140px" startColor="#1e1e3a" endColor="#2a2a4a" borderRadius="4px" />
                    </HStack>
                </Box>
                <HStack spacing={2}>
                    <Skeleton h="32px" w="32px" startColor="#1e1e3a" endColor="#2a2a4a" borderRadius="8px" />
                    <Skeleton h="32px" w="72px" startColor="#1e1e3a" endColor="#2a2a4a" borderRadius="10px" />
                </HStack>
            </Flex>

            {/* Row 2: Badges + Score */}
            <Flex px={6} pb={4} align="center" justify="space-between" gap={4}>
                <HStack spacing={1.5}>
                    <Skeleton h="20px" w="52px" startColor="#1e1e3a" endColor="#2a2a4a" borderRadius="full" />
                    <Skeleton h="20px" w="48px" startColor="#1e1e3a" endColor="#2a2a4a" borderRadius="full" />
                    <Skeleton h="20px" w="64px" startColor="#1e1e3a" endColor="#2a2a4a" borderRadius="full" />
                </HStack>
                <HStack spacing={3}>
                    <Skeleton h="28px" w="55px" startColor="#1e1e3a" endColor="#2a2a4a" borderRadius="10px" />
                </HStack>
            </Flex>
        </Box>
    );
}
