import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
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

export default function GameFooter({ onBackToMenu }: Props) {
  const [showActionsheet, setShowActionsheet] = useState(false);
  const handleClose = () => setShowActionsheet(false);
  const insets = useSafeAreaInsets();

  return (
    <>
      <View
        style={[
          styles.fab,
          { bottom: Math.max(insets.bottom, 16) + 4, right: 16 },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => setShowActionsheet(true)}
          style={({ pressed }: { pressed: boolean }) => [
            styles.fabButton,
            pressed && styles.fabButtonPressed,
          ]}
        >
          <Icon as={MoreVertical} size="lg" color="$textLight500" />
        </Pressable>
      </View>

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

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    zIndex: 10,
  },
  fabButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabButtonPressed: {
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
});
