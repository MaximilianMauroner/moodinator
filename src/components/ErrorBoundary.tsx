import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, Pressable } from "react-native";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  FallbackComponent?: React.ComponentType<ErrorFallbackProps>;
}

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Default fallback component shown when no custom fallback is provided.
 * Provides a minimal but user-friendly error display with retry option.
 */
function DefaultErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        backgroundColor: "#FAF8F4",
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          backgroundColor: "#FDE8E4",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Text style={{ fontSize: 28 }}>⚠️</Text>
      </View>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "600",
          color: "#3D352A",
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        Something went wrong
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: "#6B5C4A",
          marginBottom: 24,
          textAlign: "center",
          maxWidth: 280,
        }}
      >
        An unexpected error occurred. Tap below to try again.
      </Text>
      {__DEV__ && (
        <View
          style={{
            backgroundColor: "#F9F5ED",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            maxWidth: 320,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontFamily: "monospace",
              color: "#C75441",
            }}
            numberOfLines={3}
          >
            {error.message}
          </Text>
        </View>
      )}
      <Pressable
        onPress={resetError}
        style={{
          backgroundColor: "#5B8A5B",
          paddingVertical: 14,
          paddingHorizontal: 32,
          borderRadius: 16,
          shadowColor: "#5B8A5B",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
          Try Again
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Error boundary component that catches JavaScript errors anywhere in the
 * child component tree, logs those errors, and displays a fallback UI.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details
    if (__DEV__) {
      console.error("ErrorBoundary caught an error:", error);
      console.error("Component stack:", errorInfo.componentStack);
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, FallbackComponent } = this.props;

    if (hasError && error) {
      // Use custom FallbackComponent if provided
      if (FallbackComponent) {
        return <FallbackComponent error={error} resetError={this.resetError} />;
      }

      // Use static fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default user-friendly fallback
      return <DefaultErrorFallback error={error} resetError={this.resetError} />;
    }

    return children;
  }
}

export default ErrorBoundary;
