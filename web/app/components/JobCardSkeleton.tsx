"use client";

import { Box, Flex, HStack, Skeleton } from "@chakra-ui/react";
import { useThemeMode } from "../components/ThemeContext";

export default function JobCardSkeleton() {
    const { t } = useThemeMode();
    return (
        <Box
            bg={t.cardBg}
            border="1px solid"
            borderColor={t.cardBorder}
            borderRadius="16px"
            h="130px"
            overflow="hidden"
            position="relative"
            transition="background-color 0.35s ease, border-color 0.35s ease"
        >
            {/* Accent line */}
            <Box position="absolute" left={0} top="14px" bottom="14px" w="3px" borderRadius="0 2px 2px 0">
                <Skeleton h="100%" startColor={t.skeletonStart} endColor={t.skeletonEnd} />
            </Box>

            {/* Row 1: Title + Actions */}
            <Flex justify="space-between" align="flex-start" px={6} pt={5} pb={3} gap={4}>
                <Box flex={1}>
                    <Skeleton h="18px" w="70%" startColor={t.skeletonStart} endColor={t.skeletonEnd} borderRadius="6px" mb={2} />
                    <HStack spacing={2}>
                        <Skeleton h="14px" w="100px" startColor={t.skeletonStart} endColor={t.skeletonEnd} borderRadius="4px" />
                        <Box w="3px" h="3px" borderRadius="full" bg={t.skeletonStart} />
                        <Skeleton h="14px" w="140px" startColor={t.skeletonStart} endColor={t.skeletonEnd} borderRadius="4px" />
                    </HStack>
                </Box>
                <HStack spacing={2}>
                    <Skeleton h="32px" w="32px" startColor={t.skeletonStart} endColor={t.skeletonEnd} borderRadius="8px" />
                    <Skeleton h="32px" w="72px" startColor={t.skeletonStart} endColor={t.skeletonEnd} borderRadius="10px" />
                </HStack>
            </Flex>

            {/* Row 2: Badges + Score */}
            <Flex px={6} pb={4} align="center" justify="space-between" gap={4}>
                <HStack spacing={1.5}>
                    <Skeleton h="20px" w="52px" startColor={t.skeletonStart} endColor={t.skeletonEnd} borderRadius="full" />
                    <Skeleton h="20px" w="48px" startColor={t.skeletonStart} endColor={t.skeletonEnd} borderRadius="full" />
                    <Skeleton h="20px" w="64px" startColor={t.skeletonStart} endColor={t.skeletonEnd} borderRadius="full" />
                </HStack>
                <HStack spacing={3}>
                    <Skeleton h="28px" w="55px" startColor={t.skeletonStart} endColor={t.skeletonEnd} borderRadius="10px" />
                </HStack>
            </Flex>
        </Box>
    );
}
