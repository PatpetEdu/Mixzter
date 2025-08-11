import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface Props {
  artist: string;
  title: string;
  year: string; // Ändrat till string
  onFlip: () => void;
}

export default function CardBack({ artist, title, year, onFlip }: Props) {
  return (
    <TouchableOpacity onPress={onFlip} style={styles.card}>
      <Text style={styles.artist}>{artist}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.year}>{year}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  artist: {
    fontSize: 22,
    fontWeight: "bold",
  },
  title: {
    fontSize: 18,
    marginTop: 8,
  },
  year: {
    fontSize: 36,
    marginTop: 16,
    color: "#666",
  },
});
