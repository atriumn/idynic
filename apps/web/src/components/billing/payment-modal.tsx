"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface PaymentFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

function PaymentForm({ onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/settings/usage?success=true`,
      },
    });

    if (error) {
      onError(error.message || "Payment failed");
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          "Subscribe"
        )}
      </Button>
    </form>
  );
}

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string | null;
  plan: "pro" | "job_search";
  onSuccess: () => void;
  onError: (error: string) => void;
}

const PLAN_DETAILS = {
  pro: {
    name: "Pro",
    price: "$100/year",
    description: "Unlimited uploads, 15 tailored profiles/month",
  },
  job_search: {
    name: "Job Search",
    price: "$50 for 3 months",
    description: "Unlimited everything for active job seekers",
  },
};

export function PaymentModal({
  open,
  onOpenChange,
  clientSecret,
  plan,
  onSuccess,
  onError,
}: PaymentModalProps) {
  const planDetails = PLAN_DETAILS[plan];

  if (!clientSecret) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subscribe to {planDetails.name}</DialogTitle>
          <DialogDescription>
            {planDetails.price} - {planDetails.description}
          </DialogDescription>
        </DialogHeader>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#0f766e",
                borderRadius: "8px",
              },
            },
          }}
        >
          <PaymentForm onSuccess={onSuccess} onError={onError} />
        </Elements>
      </DialogContent>
    </Dialog>
  );
}
