import React, { useState } from 'react';
import {
  Box,
  Pressable,
  Icon,
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicatorWrapper,
  ActionsheetDragIndicator,
  ActionsheetItem,
  ActionsheetItemText,
  HStack,
} from '@gluestack-ui/themed';
import { MoreVertical, LogOut } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  onBackToMenu: () => void;
};

export default function GameFooter({ onBackToMenu }: Props) {
  const [showActionsheet, setShowActionsheet] = useState(false);
  const handleClose = () => setShowActionsheet(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <Box
        pb={insets.bottom} // Safe area padding
        bg="$backgroundLight50"
        w="$full"
        justifyContent="center"
        sx={{
          borderTopWidth: 1,
          borderTopColor: '$borderLight300',
          _dark: { 
            bg: '$backgroundDark900',
            borderTopColor: '$borderDark700'
          },
        }}
      >
        <HStack py="$2" justifyContent="flex-end" alignItems="center" pr="$3">
          <Pressable
            onPress={() => setShowActionsheet(true)}
            borderRadius="$full"
            p="$2.5"
          >
            <Icon as={MoreVertical} size="xl" />
          </Pressable>
        </HStack>
      </Box>

      <Actionsheet isOpen={showActionsheet} onClose={handleClose} zIndex={999}>
        <ActionsheetBackdrop />
        <ActionsheetContent pb={insets.bottom}>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <ActionsheetItem
            onPress={() => {
              handleClose();
              onBackToMenu();
            }}
          >
            <Icon as={LogOut} size="md" mr="$2" />
            <ActionsheetItemText>Tillbaka till menyn</ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}
