const copy = {
  confirmed: ['is confirmed', 'We have received your order. The branch will start packing it.'],
  preparing: ['is being prepared', 'The branch is packing your shoes.'],
  onTheWay: ['is on the way', 'Your pair has left the branch.'],
  completed: ['is complete', 'Thanks for shopping at Shoe Factory.'],
  cancelled: ['was cancelled', 'The order is cancelled. Any reserved stock is back on the shelf.'],
};

export function orderUpdateNotice(orderId, status) {
  const [verb, body] = copy[status] ?? ['was updated', 'There is an update on this order.'];
  return {
    title: `Order ${orderId} ${verb}`,
    body,
    kind: 'order',
    targetId: orderId,
  };
}
