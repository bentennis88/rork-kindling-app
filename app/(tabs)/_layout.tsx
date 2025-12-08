import { Tabs } from "expo-router";
import { Map } from "lucide-react-native";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#FFD700",
        tabBarInactiveTintColor: "#666666",
        tabBarStyle: {
          backgroundColor: "#000000",
          borderTopColor: "#1a1a1a",
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          tabBarIcon: ({ color }) => <Map color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
