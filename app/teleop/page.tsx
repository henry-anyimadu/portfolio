import type { Metadata } from 'next';
import { TeleopClient } from '@/components/teleop/teleop-client';

export const metadata: Metadata = {
  title: 'G1 Teleop Station · Henry Anyimadu',
  description: 'A browser teleoperation station for a simulated Unitree G1: a robot-side safety agent, an emulated network, protobuf on the wire, and a fault suite.',
};

export default function Page() {
  return <TeleopClient />;
}
