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
} from '@gluestack-ui/themed';
import { MoreVertical, LogOut } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  onBackToMenu: () => void;
};

export default function InGameMenu({ onBackToMenu }: Props) {
  const [showActionsheet, setShowActionsheet] = useState(false);
  const handleClose = () => setShowActionsheet(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <Box
        position="absolute"
        bottom={insets.bottom > 0 ? insets.bottom + 8 : 20}
        right={20}
        zIndex={1}
      >
        <Pressable
          onPress={() => setShowActionsheet(true)}
          bg="$primary500"
          borderRadius="$full"
          p="$2.5"
          elevation="$4"
        >
          <Icon as={MoreVertical} color="$white" size="lg" />
        </Pressable>
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
            <ActionsheetItemText>Avsluta spelet</ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}
